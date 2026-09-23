"""
tool_run.py — the tools that reach out, and the answer that comes back.

A `call` tool is a promise that the system will ask another program for
something. Until this module existed, nothing in the app made that call: the
register held fourteen rows and the phrase "the system asks another program" was
a description of nothing. A prompt naming one of them therefore claimed a
capability the system did not have — which is the failure the review before a Run
now stops.

WHAT A TOOL IS HERE, AND WHAT IT IS NOT. A tool is a NAMED WAY OF GETTING AN
ANSWER, with the address of whoever answers built in. `search-the-internet` is
not a search engine: it is the app's own choice of one, plus the shape of the
question and the shape of the reply. That is what makes it a tool rather than a
library — the prompt names the capability, not the vendor, and swapping the
source is a change here and nowhere else.

NO KEYS, DELIBERATELY. Everything registered here answers without an account:
Wikipedia's API and Google News' feeds are open to anyone. A tool that needs a
key is a tool that is broken until somebody buys something, and a register full
of those is a register that lies about what the system can do. When a tool does
need a key, it says so at the moment it is used — see `_Unconfigured` — rather
than returning nothing.

WHAT COMES BACK IS PUT IN FRONT OF THE MODEL AS TEXT, ALWAYS WITH ITS SOURCE.
The model's job is to work with what it was given; a fact without where it came
from cannot be checked by the person reading the answer, and this system's whole
claim is that what runs is what you can read.

A FAILURE IS A WARNING, NEVER SILENCE. `run_named_tools` returns both halves in
the shape routes/teacher.py already folds into a run: the blocks the model
should read, and the warnings that say what did not come back. A caller that
reads only the blocks cannot tell a tool that found nothing from one that never
ran.
"""

from __future__ import annotations

import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import Any, Dict, List, Optional, Tuple

# Long enough for a slow public endpoint, short enough that a Run is not held
# hostage by one. Every tool here answers in under a second in practice.
TIMEOUT_S = 12.0

# What the model is allowed to read from one tool. Three feeds of ten results is
# already a lot of prose in front of a prompt that has its own instructions; more
# than this pushes the prompt out of the model's attention rather than enriching
# it.
MAX_ITEMS = 10
MAX_ABSTRACT_CHARS = 700

# The person's own name for this system, and it is what the model is told these
# answers are: a program the app asked, not the model's own knowledge.
USER_AGENT = "RaibachIDS/1.0 (tool call; contact: support@raibach.net)"


class ToolRunError(Exception):
    """A tool that could not answer, with a reason a person can read."""


def _get(url: str, *, accept: str = "application/json") -> bytes:
    """One HTTP GET, with a timeout and a reason on failure.

    `urllib` rather than `requests`: this module is the only thing here that talks
    to the outside, and one fewer dependency to install on a machine that has to
    start from nothing is worth more than the nicer API.
    """
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": accept})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        raise ToolRunError(f"the service answered {e.code} {e.reason}") from e
    except urllib.error.URLError as e:
        raise ToolRunError(f"the service could not be reached ({e.reason})") from e
    except TimeoutError as e:
        raise ToolRunError(f"the service did not answer within {TIMEOUT_S:g}s") from e


def _stamp(value: Any) -> str:
    """A timestamp as a person reads it, from whatever the driver hands back.

    psycopg2 returns a datetime for a TIMESTAMP column, but the same query through a
    different cursor or a different build returns the text. A tool that crashes on the
    SPELLING of its own record is a tool that reports "cannot run" about something that
    ran fine, so both shapes are accepted and neither is assumed.
    """
    if not value:
        return ""
    if hasattr(value, "strftime"):
        try:
            return value.strftime("%Y-%m-%d %H:%M")
        except Exception:
            pass
    return str(value)[:16]


#: What a person says when they mean a window of time, and the operator Google News
#: uses for it. A prompt asking for "the past 24 hours" is asking for a DATE RANGE, and
#: passing those words through as search text asks the wrong question — measured
#: 2026-09-23: "insurance industry news from the past 24 hours" came back with a story
#: about marijuana and one from July. The window is taken out of the words and said as
#: the operator, which is the same question in the language the service speaks.
TIME_WINDOWS: Tuple[Tuple[Any, str], ...] = (
    (re.compile(r"\b(?:past|last|previous)\s+24\s*(?:hours?|hrs?)\b", re.I), "1d"),
    (re.compile(r"\b(?:past|last|previous)\s+(?:1|one)\s+day\b", re.I), "1d"),
    (re.compile(r"\b(?:today|today's|this\s+morning|right\s+now)\b", re.I), "1d"),
    (re.compile(r"\b(?:past|last|previous)\s+(?:7|seven)\s+days?\b", re.I), "7d"),
    (re.compile(r"\b(?:past|last|previous)\s+week\b", re.I), "7d"),
    (re.compile(r"\bthis\s+week\b", re.I), "7d"),
    (re.compile(r"\b(?:past|last|previous)\s+(?:30|thirty)\s+days?\b", re.I), "30d"),
    (re.compile(r"\b(?:past|last|previous)\s+month\b", re.I), "30d"),
    (re.compile(r"\bthis\s+month\b", re.I), "30d"),
)

#: Words that describe the asking rather than the subject. A prompt says "news about
#: insurance"; the service wants "insurance".
SEARCH_FILLER = re.compile(
    r"\b(?:news|headlines|stories|articles|look\s+up|search(?:\s+for)?|find|get|"
    r"bring\s+back|report\s+on|the|a|an|me|please)\b",
    re.I,
)

#: A preposition with nothing after it — what is left when a window is taken out of a
#: sentence ("insurance industry FROM the past 24 hours"). It has to go: measured
#: 2026-09-23, `Insurance industry from when:1d` returns an EMPTY feed while
#: `Insurance industry when:1d` returns a hundred headlines, because the service reads
#: `from` as the start of an operator and the rest of the line stops being a question.
DANGLING = re.compile(
    r"(?:^|\s)(?:from|in|on|for|of|during|within|since|at|to|into|over|about|regarding)"
    r"(?=\s|$)",
    re.I,
)


def _strip_dangling(terms: str) -> str:
    """Prepositions with nothing to attach to, off both ends, given back a real query.

    Runs outwards-in: taking "from" off "the news from" can leave "the" exposed, so the
    filler pass and this one are applied until neither has anything left to do. Bounded
    at a few rounds — a query cannot shrink forever, and a loop with no ceiling on
    user-written text is how one bad line becomes a hung request.
    """
    out = terms
    for _ in range(4):
        before = out
        out = " ".join(w for w in SEARCH_FILLER.sub(" ", out).split() if w)
        out = " ".join(w for w in DANGLING.sub(" ", out).split() if w)
        if out == before:
            break
    return out


def _news_query(question: str) -> Tuple[str, str]:
    """The person's words as the service wants them, and the window if one was asked for.

    The subject words all survive; only the ones describing the ASKING are dropped. A
    line of nothing but filler falls back to the whole line rather than being sent
    empty, because an empty query is a request for the whole internet.
    """
    text = (question or "").strip()
    when = ""
    for pattern, span in TIME_WINDOWS:
        if pattern.search(text):
            when = span
            text = pattern.sub(" ", text)
            break
    terms = _strip_dangling(text)
    if not terms:
        terms = " ".join(text.split()) or (question or "").strip()
    return terms, when


def _cell(row: Any, name: str) -> Any:
    """One column out of a row, whichever way the cursor hands rows back.

    The pool's cursor returns DICTIONARIES keyed by column name, and unpacking one by
    position yields its KEYS — which is why this tool first answered with a list of the
    words "title, description, updated_at" instead of a list of packages. Reading by
    name is right for both shapes and costs nothing.
    """
    try:
        return row[name]
    except (TypeError, KeyError, IndexError):
        return None


def _as_datetime(raw: str) -> Optional[datetime]:
    """An RFC-822 date from a feed, or None. None is not an error — see the sort."""
    try:
        return parsedate_to_datetime(str(raw))
    except Exception:
        return None


def _clean(text: Any) -> str:
    """Markup out of a public feed, and the entities it was escaped with."""
    plain = re.sub(r"<[^>]+>", "", str(text or ""))
    return html.unescape(plain).strip()


def _first(pattern: str, text: str) -> str:
    """The first group of the first match, or empty. A feed field that is absent is
    absent — not an error worth losing the other four fields over."""
    m = re.search(pattern, text, re.S)
    return m.group(1) if m else ""


# ── the tools ────────────────────────────────────────────────────────────────
#
# One function per tool. Each takes the prompt's own words (whatever the Tool
# Call seat carried after the token) and returns the text the model should read.
# The heading is written here, once, so every answer says where it came from.


def search_the_internet(query: str) -> str:
    """News, from the feed the person can open themselves.

    GOOGLE NEWS, NOT A SEARCH API. A general web search needs a paid key and
    returns a page of links to be scraped; this returns dated headlines with
    their publisher, which is what a prompt asking for "the news" actually needs
    and what the person can verify by clicking. For a question that is not news,
    the results are still real pages about the subject — narrower than a web
    search, and honest about what it read.
    """
    question = (query or "").strip()
    if not question:
        raise ToolRunError("no search terms were given")

    terms, when = _news_query(question)

    def ask(q: str) -> str:
        url = (
            "https://news.google.com/rss/search?"
            + urllib.parse.urlencode({"q": q, "hl": "en-US", "gl": "US", "ceid": "US:en"})
        )
        return _get(url, accept="application/rss+xml").decode("utf-8", "replace")

    raw = ask(f"{terms} when:{when}" if when else terms)
    if when and "<item>" not in raw:
        # A WINDOW IS NARROWING, NOT A REQUIREMENT. Asking for the last day is how the
        # person phrased it; if that returns nothing, the honest next question is the
        # same one without the window — a tool that answers "nothing found" about a
        # subject that has news is worse than one that answers slightly wider and says
        # so. Measured 2026-09-23 on a query whose window operator emptied the feed.
        raw = ask(terms)
        if "<item>" in raw:
            print(f"ℹ️  [tool_run] nothing in the last {when} for {terms!r} — widened the window")
            when = ""

    items = re.findall(r"<item>(.*?)</item>", raw, re.S)
    if not items:
        return f'GOOGLE NEWS — nothing found for "{question}".'

    rows: List[Tuple[str, str, str]] = []
    for item in items:
        rows.append((
            _clean(_first(r"<title>(.*?)</title>", item)),
            _clean(_first(r"<pubDate>(.*?)</pubDate>", item)),
            _clean(_first(r"<source[^>]*>(.*?)</source>", item)),
        ))
    # NEWEST FIRST, on the date the feed gave. The feed answers in its own relevance
    # order, which for a question about the last day is the wrong order — the person
    # asked what is happening, and the answer is the most recent thing that happened.
    # A date that will not parse sorts last rather than being dropped: it is still a
    # headline somebody published.
    rows.sort(key=lambda r: _as_datetime(r[1]) or datetime.min, reverse=True)

    window = f", published in the last {when.replace('d', ' day(s)')}" if when else ""
    lines = [f'NEWS HEADLINES for "{terms}"{window} — Google News, read now:']
    for title, date, source in rows[:MAX_ITEMS]:
        lines.append(f"- {title}" + (f" — {source}" if source else "") + (f" ({date})" if date else ""))
    lines.append("")
    lines.append(
        "These are headlines with their publisher and date, nothing more: the "
        "articles themselves were not read. Do not describe what an article says."
    )
    return "\n".join(lines)


def read_a_wiki(query: str) -> str:
    """The encyclopaedia's own opening on a subject, with its articles cited."""
    subject = (query or "").strip()
    if not subject:
        raise ToolRunError("no subject was given")
    base = "https://en.wikipedia.org/w/api.php"
    search = json.loads(
        _get(
            base
            + "?"
            + urllib.parse.urlencode(
                {"action": "query", "list": "search", "srsearch": subject, "format": "json", "srlimit": 3}
            )
        )
    )
    hits = (search.get("query") or {}).get("search") or []
    if not hits:
        return f'WIKIPEDIA — no article found for "{subject}".'

    titles = [h["title"] for h in hits]
    extracts = json.loads(
        _get(
            base
            + "?"
            + urllib.parse.urlencode(
                {
                    "action": "query",
                    "prop": "extracts",
                    "exintro": 1,
                    "explaintext": 1,
                    "titles": "|".join(titles),
                    "format": "json",
                }
            )
        )
    )
    pages = (extracts.get("query") or {}).get("pages") or {}
    by_title = {p.get("title"): p.get("extract") or "" for p in pages.values()}

    lines = [f'WIKIPEDIA, read now, for "{subject}":']
    for title in titles:
        body = _clean(by_title.get(title, ""))
        if not body:
            continue
        if len(body) > MAX_ABSTRACT_CHARS:
            body = body[:MAX_ABSTRACT_CHARS].rsplit(" ", 1)[0] + "…"
        lines.append(f"\n## {title}\n{body}\n(source: https://en.wikipedia.org/wiki/{urllib.parse.quote(title.replace(' ', '_'))})")
    lines.append("")
    lines.append("WIKIPEDIA IS BACKGROUND, NOT NEWS, and it is written by its readers.")
    return "\n".join(lines)


def research_a_topic(query: str) -> str:
    """Two sources for one question: what it is, and what is being said about it.

    This is the tool for "find out about X" — the encyclopaedia's opening for the
    ground, and the news for the current state. Both answers are headed so the
    model can tell which is which, and a source that fails is reported as a line
    rather than taking the whole answer down with it.
    """
    subject = (query or "").strip()
    if not subject:
        raise ToolRunError("no subject was given")
    parts: List[str] = []
    for label, fn in (("BACKGROUND", read_a_wiki), ("CURRENT", search_the_internet)):
        try:
            parts.append(fn(subject))
        except ToolRunError as e:
            parts.append(f"{label} — could not be read: {e}")
    return "\n\n".join(parts)


def query_a_database(query: str) -> str:
    """What this system itself holds — asked of its own database, in its own words.

    NOT SQL, AND NOT A DEVELOPER'S TOOL. The question is answered from the tables
    this app already keeps: what prompts exist, what the last runs did. A tool
    that let a PROMPT run arbitrary SQL would be a hole in the product, not a
    feature of it — and it would make the prompt unsafe to read, which is the one
    promise this system keeps everywhere else.
    """
    from database_pool import DatabasePoolManager

    question = (query or "").strip().lower()
    # THROUGH `get_instance`, the one accessor — not the constructor. The constructor
    # wants the URL and builds a SECOND pool beside the one the app is already using,
    # which is a connection leak with a friendly name. tools.py reads the same way.
    db = DatabasePoolManager.get_instance()
    with db.get_connection() as conn:
        cur = conn.cursor()
        if "prompt" in question or "package" in question:
            cur.execute(
                """
                SELECT title, description, updated_at FROM prompt_sessions
                WHERE is_archived IS NOT TRUE
                ORDER BY updated_at DESC LIMIT %s
                """,
                (MAX_ITEMS,),
            )
            rows = cur.fetchall()
            cur.close()
            if not rows:
                return "THIS SYSTEM'S OWN RECORDS — no prompt packages exist yet."
            lines = ["PROMPT PACKAGES IN THIS SYSTEM, most recently changed first:"]
            for row in rows:
                stamp = _stamp(_cell(row, "updated_at"))
                title = _cell(row, "title")
                description = _cell(row, "description")
                lines.append(
                    f"- {title or '(untitled)'}"
                    + (f" — {description}" if description else "")
                    + (f" (changed {stamp})" if stamp else "")
                )
            return "\n".join(lines)

        cur.execute(
            """
            SELECT c.title, c.updated_at, count(m.id)
            FROM conversations c
            LEFT JOIN conversation_messages m ON m.conversation_id = c.id
            GROUP BY c.id, c.title, c.updated_at
            ORDER BY c.updated_at DESC LIMIT %s
            """,
            (MAX_ITEMS,),
        )
        rows = cur.fetchall()
        cur.close()
        if not rows:
            return "THIS SYSTEM'S OWN RECORDS — no conversations exist yet."
        lines = ["CONVERSATIONS IN THIS SYSTEM, most recently changed first:"]
        for row in rows:
            stamp = _stamp(_cell(row, "updated_at"))
            title = _cell(row, "title")
            count = _cell(row, "count")
            lines.append(
                f"- {title or '(untitled)'} — {count} message(s)"
                + (f" (changed {stamp})" if stamp else "")
            )
        return "\n".join(lines)


#: The name a prompt uses, and the thing that answers it. A row in the `tools`
#: table whose `runner` names something absent from here is a row that cannot
#: run, which is what the review before a Run checks.
RUNNERS = {
    "news": search_the_internet,
    "wikipedia": read_a_wiki,
    "research": research_a_topic,
    "this-database": query_a_database,
}


def run_tool(name: str, query: str) -> str:
    """One registered tool, by the runner its row names. Raises with a reason."""
    from tools import get_tool, ToolError

    try:
        row = get_tool(name)
    except ToolError as e:
        raise ToolRunError(str(e)) from e
    runner = (row or {}).get("runner")
    if not runner:
        # THE HONEST ANSWER TO A TOOL WITH NOTHING BEHIND IT. It is registered, it
        # can be read, it can be written into a prompt — and pressing Run will not
        # make it do anything, because no program answers to it. Saying so is the
        # only alternative to a prompt that claims a capability that is not there.
        raise ToolRunError(
            f'"{name}" has nothing behind it yet — it can be written into a prompt, '
            "but no service answers it, so it cannot run."
        )
    fn = RUNNERS.get(str(runner))
    if fn is None:
        raise ToolRunError(f'"{name}" names a runner ({runner}) this system does not have.')
    return fn(query)


#: `{{tool:name}}` — the one token a Tool Call seat carries, written by the seat's
#: own menu and by the assistant. Everything after it on the line is the question.
TOOL_TOKEN = re.compile(r"\{\{tool:([A-Za-z0-9._-]+)\}\}")


def named_tools(text: str) -> List[Tuple[str, str]]:
    """Every tool a prompt names, with the words that follow its token.

    ONE TOKEN, ONE QUESTION, and the question runs to the next token or the end of
    the text. That is the shape the menu writes — the token's own line, then the
    tool's prose — so the first line or two after the token is what the person
    wrote and the rest is the tool's own words. Both are handed to the runner;
    what it does with them is the runner's business (see `search_the_internet`,
    which uses the whole thing as the query).
    """
    found: List[Tuple[str, str]] = []
    matches = list(TOOL_TOKEN.finditer(text or ""))
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = (text or "")[m.end():end].strip()
        found.append((m.group(1), body))
    return found


def _query_for(name: str, body: str) -> str:
    """What to ask the service, from what the seat carries.

    The seat holds the tool's own description first and the person's question
    after it, because that is the order the menu writes them in. The question is
    the LAST non-empty line for the same reason: it is what was added last, by a
    person who was reading the tool's words while they typed.
    """
    lines = [ln.strip() for ln in (body or "").splitlines() if ln.strip()]
    if not lines:
        return ""
    return lines[-1]


def run_named_tools(pairs: List[Tuple[str, str]]) -> Tuple[List[str], List[str]]:
    """Execute every tool a prompt names. Returns (blocks, warnings).

    BOTH ARE ALWAYS RETURNED, in the shape routes/teacher.py already folds into a
    run (`tool_context` / `tool_warnings`), so a tool that failed is carried into
    the prompt as something the model must not paper over rather than as an
    absence nobody mentions.
    """
    blocks: List[str] = []
    warnings: List[str] = []
    for name, body in pairs:
        started = time.time()
        try:
            answer = run_tool(name, _query_for(name, body))
        except ToolRunError as e:
            warnings.append(f'{name}: {e}')
            print(f"⚠️  [tool_run] {name} — {e}")
            continue
        took = time.time() - started
        blocks.append(answer)
        print(f"ℹ️  [tool_run] {name} answered {len(answer)} chars in {took:.2f}s")
    return blocks, warnings
