import { cn } from "@/src/utils/tailwind";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/src/components/ui/select";
import { useRouter } from "next/router";

type SettingsProps = {
  pages: Array<
    {
      title: string;
      slug: string;
      section?: string;
      show?: boolean | (() => boolean);
    } & ({ content: ReactNode } | { href: string })
  >;
  activeSlug?: string;
  fullHeight?: boolean;
};

export const PagedSettingsContainer = ({
  pages,
  activeSlug,
  fullHeight = false,
}: SettingsProps) => {
  const router = useRouter();
  const availablePages = pages.filter((page) => {
    if ("show" in page) {
      if (typeof page.show === "function") {
        return page.show();
      }
      return page.show;
    }
    return true;
  });

  const currentPage =
    availablePages.find((page) => page.slug === activeSlug) ??
    availablePages[0]; // Fallback to first page if not found

  const onChange = (newSlug: string) => {
    /* Raibach IDS embed fix (owner-approved, 2026-10-09): asPath can carry a query
       string — the studio loads every embedded page as `...?embedded=console&house_door=dev`
       — and the original test read the last segment as `settings?embedded=...`, judged it
       "not /settings", popped the segment, and routed to /project/<id>/api-keys (404,
       reproduced live in the room). Navigation segments are path segments: the query and
       hash are not part of them. */
    const pathSegments = router.asPath.split(/[?#]/)[0].split("/");
    if (pathSegments[pathSegments.length - 1] !== "settings")
      pathSegments.pop();
    if (newSlug !== "index") pathSegments.push(newSlug);
    router.push(pathSegments.join("/"));
  };

  return (
    <main
      className={cn(
        // RAIBACH IDS (2026-10-12, owner's settings pass): 20px above the
        // section — equal top spacing throughout the app.
        "flex flex-1 flex-col gap-4 pt-5 pb-4 md:gap-8",
        fullHeight && "min-h-0 overflow-hidden",
      )}
    >
      <div
        className={cn(
          "grid w-full items-start gap-4 md:grid-cols-[150px_1fr] lg:grid-cols-[220px_1fr]",
          fullHeight &&
            "min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] md:grid-rows-1",
        )}
      >
        <nav className="block md:hidden">
          <Select
            onValueChange={(slug) => {
              const page = availablePages.find((p) => p.slug === slug);
              if (page && "href" in page) router.push(page.href);
              else onChange(slug);
            }}
            value={currentPage.slug}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a page" />
            </SelectTrigger>
            <SelectContent>
              {groupPagesBySection(availablePages).map((group) => (
                <SelectGroup key={group.section ?? "default"}>
                  {group.section ? (
                    <SelectLabel>{group.section}</SelectLabel>
                  ) : null}
                  {group.pages.map((page) => (
                    <SelectItem key={page.title} value={page.slug}>
                      {page.title}
                      {"href" in page && (
                        <ArrowUpRight className="icon-base ml-1 inline" />
                      )}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
        </nav>
        <nav
          className={cn(
            // RAIBACH IDS (2026-10-12, owner's settings pass): the left column
            // wears the dashboard container — same fill as the dashboards
            // (rgba(17,14,31,0.75), 6px radius). REVERT: drop the md:* boxes.
            "text-muted-foreground hidden text-sm md:sticky md:top-5 md:grid md:gap-y-1 md:rounded-md md:bg-[rgba(17,14,31,0.75)] md:p-2",
            fullHeight && "md:top-0",
          )}
          x-chunk="dashboard-04-chunk-0"
        >
          {availablePages.map((page, index) => (
            <Fragment key={page.title}>
              {page.section &&
              page.section !== availablePages[index - 1]?.section ? (
                <span className="text-muted-foreground mt-4 flex h-8 items-center px-2 text-xs font-bold first:mt-0">
                  {page.section}
                </span>
              ) : null}
              {"href" in page ? (
                <Link
                  href={page.href}
                  className="hover:bg-muted hover:text-foreground flex h-8 flex-row items-center gap-2 rounded-sm px-2"
                >
                  {page.title}
                  <ArrowUpRight className="icon-base inline" />
                </Link>
              ) : (
                <span
                  onClick={() => onChange(page.slug)}
                  className={cn(
                    "hover:bg-muted hover:text-foreground flex h-8 cursor-pointer items-center rounded-sm px-2",
                    page.slug === currentPage.slug &&
                      "bg-muted text-primary font-bold",
                  )}
                >
                  {page.title}
                </span>
              )}
            </Fragment>
          ))}
        </nav>
        <div
          className={cn(
            // RAIBACH IDS (2026-10-12, owner's settings pass): everything in
            // the right column lives in one dashboard container.
            "w-full overflow-hidden rounded-md bg-[rgba(17,14,31,0.75)] p-4",
            fullHeight && "h-full min-h-0",
          )}
        >
          {currentPage && "content" in currentPage ? currentPage.content : null}
        </div>
      </div>
    </main>
  );
};

function groupPagesBySection<T extends { section?: string }>(pages: T[]) {
  return pages.reduce<Array<{ section: string | undefined; pages: T[] }>>(
    (groups, page) => {
      const previous = groups.at(-1);
      if (previous && previous.section === page.section) {
        previous.pages.push(page);
      } else {
        groups.push({ section: page.section, pages: [page] });
      }
      return groups;
    },
    [],
  );
}
