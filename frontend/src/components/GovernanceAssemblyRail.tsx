// (no logo import — the owner removed the R from this rail, 2026-10-07)

/**
 * THE GOVERNANCE ROOM'S RAIL (owner, 2026-10-07 — wired the same evening).
 *
 * WHERE IT LIVES: the governance room's left edge (WritingAreaIndex), over the served
 * governance app — during the staged opening AND after it lands. The history in one
 * breath: the entries began in the shell's nav (wrong — *"the menu is appearing in all
 * sections"*); the owner then called it to this room (*"move that navigation to the
 * governance tab right now"*), used the development room as the STYLING reference
 * (*"that's why I keep referring back to the development"*), and — seeing the loaded
 * app cover it — gave the wiring order: *"so now it's time to wire it up, I guess, to
 * the app, and then remove the app's navigation."* So this rail DRIVES the embedded app
 * (each entry writes the frame's own path) and the app's own navigation is hidden by
 * the house patch served with its UI (governance/preview/openmetadata/house-patch/).
 *
 * NO LOGOS (owner, later the same evening: *"you can remove the logos"*): the house R
 * left the rail's top, the app's own logo and its dead sidebar-collapse toggle are
 * hidden by the house patch — and the empty slot the R left is closed up, the eight
 * entries start at the top.
 *
 * WHAT THE BAR IS: the house's black (#110E1F — *"It's a black bar… It's not white.
 * It's not transparent."*), the eight entries from the top, settings and the
 * workspace's status at the bottom, sitting over the lab tile the cover paints.
 *
 * THE EIGHT: the tool's own left-nav icons, ported byte-for-byte (paths, stroke
 * weights 1.2–1.5, masks; fill none + currentColor so they read as line art in house
 * colors). Each entry carries the path the tool's own navigation used — the rail
 * writes it onto the room's embed; destinations are the app's own routes, reached the
 * app's own way.
 *
 * THE BOTTOM TWO: the gear is the rail's settings seat — the platform's real settings
 * door is the chat panel's cog (owner, 2026-10-07), so it waits for a destination the
 * owner names. The rack's dot is TWO-STATE and honest: green while the workspace is up
 * (the frame is bound and standing), red when the room's clocks found it down
 * (setGovernanceToolDown) — "a stopped workspace draws nothing" holds for the payload;
 * the rail still tells the truth about why.
 */

// ── THE EIGHT — the tool's own left-nav icons, ported 2026-10-07 ──

// Home — the tool's "Home" entry icon
const OmHomeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" aria-hidden="true" focusable="false">    <path d="M3.6 10.4618C3.6 9.45277 4.04689 8.49791 4.82243 7.85627C5.89397 6.96972 7.38616 5.74125 8.67113 4.70559C9.31397 4.18747 9.90234 3.71972 10.3592 3.3678C10.588 3.19158 10.7805 3.04699 10.9287
    2.94058C11.0029 2.88728 11.0628 2.84591 11.1086 2.81592C11.1525 2.78714 11.1708 2.77729 11.1707 2.77716C11.1707 2.77715 11.1704 2.77729 11.1698 2.77757C11.7005 2.52369 12.3318 2.56414 12.6794 2.75965C14.4359
    3.74781 17.7657 6.32189 19.7192 7.87179C20.5136 8.50202 20.9714 9.46518 20.9714 10.4868V18C20.9714 19.8778 19.4492 21.4 17.5714 21.4H7C5.12223 21.4 3.6 19.8778 3.6 18V10.4618Z" stroke="currentColor"
    strokeWidth="1.2"></path>
    <rect x="9.43398" y="13.4333" width="6.3" height="7.96667" rx="1.4" stroke="currentColor" strokeWidth="1.2"></rect>
</svg>
);

// Explore — the tool's "Explore" entry icon
const OmExploreIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" aria-hidden="true" focusable="false">    <circle cx="12" cy="12" r="9.4" stroke="currentColor" strokeWidth="1.2"></circle>
    <mask id="path-2-outside-1_9045_39208" maskUnits="userSpaceOnUse" x="4.80561" y="5.13436" width="13.8688" height="12.8619" fill="black">
    <rect fill="white" x="4.80561" y="5.13436" width="13.8688" height="12.8619"></rect>
    <path fillRule="evenodd" clipRule="evenodd" d="M12.6522 13.0603L15.4614 9.00866L10.9252 10.9398L10.9249 10.9395L8.11567 14.9911L12.6519 13.06L12.6522 13.0603Z"></path>
    </mask>
    <path d="M15.4614 9.00866L16.4476 9.69241C16.7522 9.25312 16.7295 8.66532 16.3919 8.25084C16.0543 7.83636 15.4833 7.69516 14.9914 7.90454L15.4614 9.00866ZM12.6522 13.0603L11.7217 13.8181C11.9599 14.1105
    12.3217 14.2739 12.6985 14.2594C13.0754 14.2448 13.4234 14.0539 13.6383 13.744L12.6522 13.0603ZM10.9252 10.9398L9.99473 11.6976C10.3323 12.1121 10.9034 12.2533 11.3952 12.0439L10.9252 10.9398ZM10.9249
    10.9395L11.8554 10.1816C11.6172 9.88923 11.2554 9.72579 10.8786 9.74035C10.5017 9.75491 10.1537 9.94578 9.93878 10.2557L10.9249 10.9395ZM8.11567 14.9911L7.12953 14.3073C6.82494 14.7466 6.84765 15.3344
    7.18523 15.7489C7.52281 16.1634 8.09385 16.3046 8.5857 16.0952L8.11567 14.9911ZM12.6519 13.06L13.5824 12.3021C13.2448 11.8877 12.6737 11.7465 12.1819 11.9558L12.6519 13.06ZM14.4753 8.3249L11.666
    12.3765L13.6383 13.744L16.4476 9.69241L14.4753 8.3249ZM11.3952 12.0439L15.9315 10.1128L14.9914 7.90454L10.4551 9.83565L11.3952 12.0439ZM11.8556 10.1819L11.8554 10.1816L9.99448 11.6973L9.99473 11.6976L11.8556
    10.1819ZM9.93878 10.2557L7.12953 14.3073L9.10181 15.6748L11.9111 11.6232L9.93878 10.2557ZM8.5857 16.0952L13.122 14.1641L12.1819 11.9558L7.64564 13.887L8.5857 16.0952ZM13.5826 12.3025L13.5824 12.3021L11.7215
    13.8178L11.7217 13.8181L13.5826 12.3025Z" fill="currentColor" mask="url(#path-2-outside-1_9045_39208)"></path>
    <path d="M12 3.05261L12 4.10524" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"></path>
    <path d="M12 19.8947L12 20.9473" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"></path>
    <path d="M19.8945 11.9811H20.9472" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"></path>
    <path d="M3.05273 12.0187H4.10537" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"></path>
</svg>
);

// Lineage — the tool's "Lineage" entry icon
const OmLineageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" aria-hidden="true" focusable="false">    <rect x="-0.6" y="0.6" width="4.72602" height="4.72592" rx="1.4" transform="matrix(-1 0 0 1 19.8 2)" stroke="currentColor" strokeWidth="1.2"></rect>
    <rect x="-0.6" y="0.6" width="4.72602" height="4.72592" rx="1.4" transform="matrix(-1 0 0 1 19.8 9.03705)" stroke="currentColor" strokeWidth="1.2"></rect>
    <rect x="-0.6" y="0.6" width="4.72602" height="4.72592" rx="1.4" transform="matrix(-1 0 0 1 19.8 16.074)" stroke="currentColor" strokeWidth="1.2"></rect>
    <rect x="-0.6" y="0.6" width="5.37418" height="5.37407" rx="1.4" transform="matrix(-1 0 0 1 7.94844 8.66669)" stroke="currentColor" strokeWidth="1.2"></rect>
    <path d="M8.87078 12.0463H15.2598" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"></path>
    <path d="M15.3066 5.10187H13.8251C13.4239 5.1173 12.6214 5.37965 12.6214 6.30557C12.6214 7.23149 12.6214 8.63581 12.6214 9.22223C12.6214 10.1019 12.0751 10.4722 11.3714 10.4722C10.6677 10.4722 9.41149 10.4722
    8.87135 10.4722" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"></path>
    <path d="M15.3066 19.037H13.8251C13.4239 19.0216 12.6214 18.7592 12.6214 17.8333C12.6214 16.9074 12.6214 15.503 12.6214 14.9166C12.6214 14.037 12.0751 13.6666 11.3714 13.6666C10.6677 13.6666 9.41149 13.6666
    8.87135 13.6666" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"></path>
</svg>
);

// Observability — the tool's "Observability" entry icon
const OmObservabilityIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" aria-hidden="true" focusable="false">    <g clipPath="url(#clip0_9049_154851)">
    <circle cx="15" cy="9" r="6.4" stroke="currentColor" strokeWidth="1.2"></circle>
    <path d="M12 9L11.54 8.61482L11.2175 9L11.54 9.38518L12 9ZM12 9C11.54 9.38518 11.54 9.38527 11.5401 9.38537L11.5403 9.38562L11.5409 9.38624L11.5424 9.38804L11.5472 9.39378L11.5641 9.41351C11.5784 9.43021
    11.5989 9.45387 11.6251 9.48348C11.6775 9.54266 11.7527 9.6259 11.8469 9.72523C12.0344 9.92311 12.3005 10.1886 12.6128 10.4559C12.9232 10.7215 13.2918 10.9997 13.6845 11.2141C14.0703 11.4248 14.5264 11.6 15
    11.6C15.4736 11.6 15.9297 11.4248 16.3155 11.2141C16.7082 10.9997 17.0768 10.7215 17.3872 10.4559C17.6995 10.1886 17.9656 9.92311 18.1531 9.72523C18.2473 9.6259 18.3225 9.54266 18.3749 9.48348C18.4011
    9.45387 18.4216 9.43021 18.4359 9.41351L18.4528 9.39378L18.4576 9.38804L18.4591 9.38624L18.4597 9.38562L18.4599 9.38537C18.46 9.38527 18.46 9.38518 18 9M12 9C11.54 8.61482 11.54 8.61473 11.5401
    8.61463L11.5403 8.61438L11.5409 8.61376L11.5424 8.61196L11.5472 8.60622L11.5641 8.58649C11.5784 8.56979 11.5989 8.54613 11.6251 8.51652C11.6775 8.45734 11.7527 8.3741 11.8469 8.27477C12.0344 8.07689 12.3005
    7.8114 12.6128 7.54412C12.9232 7.27851 13.2918 7.00032 13.6845 6.78589C14.0703 6.57523 14.5264 6.4 15 6.4C15.4736 6.4 15.9297 6.57523 16.3155 6.78589C16.7082 7.00032 17.0768 7.27851 17.3872 7.54412C17.6995
    7.8114 17.9656 8.07689 18.1531 8.27477C18.2473 8.3741 18.3225 8.45734 18.3749 8.51652C18.4011 8.54613 18.4216 8.56979 18.4359 8.58649L18.4528 8.60622L18.4576 8.61196L18.4591 8.61376L18.4597 8.61438L18.4599
    8.61463C18.46 8.61473 18.46 8.61482 18 9M18 9L18.46 9.38518L18.7825 9L18.46 8.61482L18 9Z" stroke="currentColor" strokeWidth="1.2"></path>
    <circle cx="15" cy="9" r="1" stroke="currentColor" strokeWidth="1.2"></circle>
    <path d="M10 16.4937L7.50631 14L3.5164 17.9898C2.82781 18.6785 2.82778 19.7949 3.5164 20.4835C4.20501 21.1721 5.3216 21.1722 6.01009 20.4835C6.50865 19.9848 10 16.4937 10 16.4937Z" stroke="currentColor"
    strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"></path>
    <path d="M9 15L10.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"></path>
    <path d="M6 16L8 18" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"></path>
    </g><defs><clipPath id="clip0_9049_154851">
    <rect width="20" height="20" fill="white" transform="translate(2 2)"></rect></clipPath></defs>
</svg>
);

// Insights — the tool's "Insights" entry icon
const OmInsightsIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" aria-hidden="true" focusable="false">    <path d="M10.7543 17.4565C10.5328 17.4565 10.3293 17.3344 10.225 17.139L10.2249 17.1389M10.7543 17.4565L10.2249 17.1389M10.7543 17.4565H14.0476C14.3011 17.4565 14.5272 17.2972 14.6125 17.0586M10.7543
    17.4565L14.6125 17.0586M10.2249 17.1389L10.2243 17.1378L10.2203 17.1303L10.2021 17.0973C10.1855 17.0676 10.1604 17.0231 10.1273 16.9665C10.0612 16.8533 9.96392 16.6927 9.84157 16.5069C9.59421 16.1313 9.25586
    15.6707 8.8749 15.2898C8.00012 14.4151 7.15867 13.3772 7.01656 11.7789C6.94428 10.966 7.0159 10.2448 7.266 9.56624C7.51527 8.88996 7.92771 8.29446 8.48171 7.71276C10.5745 5.51531 14.1508 5.51531 16.2436
    7.71276C16.7966 8.29345 17.2121 8.88886 17.463 9.56549C17.7151 10.2451 17.7869 10.9681 17.7084 11.7833C17.5521 13.4038 16.7101 14.3536 15.7738 15.2898C15.3654 15.6981 15.0717 16.1456 14.8797 16.4948C14.7842
    16.6683 14.7155 16.8145 14.6715 16.9151C14.6495 16.9654 14.6338 17.004 14.624 17.0287L14.6139 17.0549L14.6126 17.0583C14.6126 17.0584 14.6126 17.0585 14.6125 17.0586M10.2249 17.1389L14.0476 16.8565C14.6126
    17.0583 14.6126 17.0585 14.6125 17.0586" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"></path>
    <path d="M12.313 10.0725L10.9961 11.9687H13.3666L12.313 13.6278" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"></path>
    <rect x="8.40195" y="17.8" width="8.20045" height="2.8" rx="1.4" stroke="currentColor" strokeWidth="1.2"></rect>
    <path d="M4.99994 5L6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"></path>
    <path d="M18.0019 16L19.002 17" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"></path>
    <rect x="10.3961" y="20.832" width="4.04024" height="1.76798" rx="0.883989" stroke="currentColor" strokeWidth="1.2"></rect>
    <path d="M18.002 4L17.0019 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"></path>
    <path d="M7.00391 17.0001L6.00384 18.0001" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"></path>
    <path d="M11.6567 2L11.6659 3.4389" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"></path>
    <path d="M21.4083 10.8292L19.9692 10.8384" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"></path>
    <path d="M4.43955 11.7455L3.00046 11.7548" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"></path>
</svg>
);

// Data Marketplace — the tool's "Data Marketplace" entry icon
const OmMarketplaceIcon = () => (
  <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" aria-hidden="true" focusable="false">    <path d="M15.5292 9.19995V6.54283C15.5292 4.58618 13.8537 3 11.7868 3C9.72 3 8.04449 4.58618 8.04449 6.54283V9.19995" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
    <path d="M19.4332 11.5501C19.3122 10.175 19.2517 9.48736 18.93 8.96694C18.6467 8.50866 18.2249 8.14124 17.719 7.91206C17.1444 7.6518 16.4156 7.6518 14.9579 7.6518L8.25283 7.65179C6.79517 7.65179 6.06634
    7.65179 5.49179 7.91205C4.98586 8.14124 4.56405 8.50866 4.28078 8.96694C3.9591 9.48736 3.89857 10.175 3.77752 11.5501L3.12261 18.9901C2.98192 20.5883 2.91157 21.3875 3.19696 22.004C3.44769 22.5456 3.88213
    22.9926 4.43147 23.2741C5.05671 23.5945 5.90378 23.5945 7.59792 23.5945L9.54912 23.5945H11.8881" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
    <path d="M25 15.0456C25 16.0158 22.5077 16.8023 19.4333 16.8023C16.3588 16.8023 13.8665 16.0158 13.8665 15.0456M25 15.0456C25 14.0755 22.5077 13.289 19.4333 13.289C16.3588 13.289 13.8665 14.0755 13.8665
    15.0456M25 15.0456V23.2434C25 24.2154 22.5259 25 19.4333 25C16.3406 25 13.8665 24.2154 13.8665 23.2434V15.0456M25 19.1445C25 20.1165 22.5259 20.9011 19.4333 20.9011C16.3406 20.9011 13.8665 20.1165 13.8665
    19.1445" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"></path>
</svg>
);

// Govern — the tool's "Govern" entry icon
const OmGovernIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" aria-hidden="true" focusable="false">    <path d="M2.83398 21.4941H20.959" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"></path>
    <rect x="4.68398" y="10.9662" width="14.6333" height="10.4338" stroke="currentColor" strokeWidth="1.2"></rect>
    <rect x="7.6" y="10.9662" width="8.8" height="10.4338" stroke="currentColor" strokeWidth="1.2"></rect>
    <rect x="10.516" y="14.0011" width="2.96667" height="7.39887" stroke="currentColor" strokeWidth="1.2"></rect>
    <path d="M2.6 9.59044C2.6 9.11276 2.84292 8.66163 3.23755 8.40538L11.2375 3.21051C11.7013 2.90939 12.2987 2.90939 12.7625 3.21051L20.7625 8.40538C21.1571 8.66163 21.4 9.11276 21.4 9.59044C21.4 10.3715 20.7654
    11.0105 20 11.0105H4C3.23456 11.0105 2.6 10.3715 2.6 9.59044Z" stroke="currentColor" strokeWidth="1.2"></path>
    <circle cx="12.0417" cy="7.44792" r="1.04167" stroke="currentColor" strokeWidth="1.2"></circle>
</svg>
);

// Context Center — the tool's "Context Center" entry icon
const OmContextCenterIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" aria-hidden="true" focusable="false">    <path d="M7.11914 7H5.19914" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"></path>
    <path d="M7.11914 10.2002H5.19914" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"></path>
    <path d="M10 6.2C10 5.35131 9.66286 4.53737 9.06274 3.93726C8.46263 3.33714 7.64869 3 6.8 3H5.2C4.07989 3 3.51984 3 3.09202 3.21799C2.71569 3.40973 2.40973 3.71569 2.21799 4.09202C2 4.51984 2 5.07989 2
    6.2V11.8C2 12.9201 2 13.4802 2.21799 13.908C2.40973 14.2843 2.71569 14.5903 3.09202 14.782C3.51984 15 4.07989 15 5.2 15H7.6C8.23652 15 8.84697 15.2529 9.29706 15.7029C9.74714 16.153 10 16.7635 10 17.4M10
    6.2V17.4M10 6.2C10 5.35131 10.3371 4.53737 10.9373 3.93726C11.5374 3.33714 12.3513 3 13.2 3H14.8C15.9201 3 16.4802 3 16.908 3.21799C17.2843 3.40973 17.5903 3.71569 17.782 4.09202C18 4.51984 18 5.07989 18
    6.2V11.8C18 12.9201 18 13.4802 17.782 13.908C17.5903 14.2843 17.2843 14.5903 16.908 14.782C16.4802 15 15.9201 15 14.8 15H12.4C11.7635 15 11.153 15.2529 10.7029 15.7029C10.2529 16.153 10 16.7635 10 17.4"
    stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"></path>
</svg>
);

// Settings — the tool's gear, for the rail's bottom group
const OmSettingsIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" aria-hidden="true" focusable="false">
  <path d="M12 15.2273C13.5062 15.2273 14.7273 14.0062 14.7273 12.5C14.7273 10.9938 13.5062 9.77273 12 9.77273C10.4938 9.77273 9.27273 10.9938 9.27273 12.5C9.27273 14.0062 10.4938 15.2273
  12 15.2273Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"></path>
  <path d="M18.7273 15.2273C18.6063 15.5015 18.5702 15.8056 18.6236 16.1005C18.6771 16.3954 18.8177 16.6676 19.0273 16.8818L19.0818 16.9364C19.2509 17.1052 19.385 17.3057 19.4765
  17.5265C19.568 17.7472 19.6151 17.9838 19.6151 18.2227C19.6151 18.4617 19.568 18.6983 19.4765 18.919C19.385 19.1397 19.2509 19.3402 19.0818 19.5091C18.913 19.6781 18.7124 19.8122 18.4917
  19.9037C18.271 19.9952 18.0344 20.0423 17.7955 20.0423C17.5565 20.0423 17.3199 19.9952 17.0992 19.9037C16.8785 19.8122 16.678 19.6781 16.5091 19.5091L16.4545 19.4545C16.2403 19.245
  15.9682 19.1044 15.6733 19.0509C15.3784 18.9974 15.0742 19.0335 14.8 19.1545C14.5311 19.2698 14.3018 19.4611 14.1403 19.705C13.9788 19.9489 13.8921 20.2347 13.8909 20.5273V20.6818C13.8909
  21.164 13.6994 21.6265 13.3584 21.9675C13.0174 22.3084 12.5549 22.5 12.0727 22.5C11.5905 22.5 11.1281 22.3084 10.7871 21.9675C10.4461 21.6265 10.2545 21.164 10.2545 20.6818V20.6C10.2475
  20.2991 10.1501 20.0073 9.97501 19.7625C9.79991 19.5176 9.55521 19.3312 9.27273 19.2273C8.99853 19.1063 8.69437 19.0702 8.39947 19.1236C8.10456 19.1771 7.83244 19.3177 7.61818
  19.5273L7.56364 19.5818C7.39478 19.7509 7.19425 19.885 6.97353 19.9765C6.7528 20.068 6.51621 20.1151 6.27727 20.1151C6.03834 20.1151 5.80174 20.068 5.58102 19.9765C5.36029 19.885 5.15977
  19.7509 4.99091 19.5818C4.82186 19.413 4.68775 19.2124 4.59626 18.9917C4.50476 18.771 4.45766 18.5344 4.45766 18.2955C4.45766 18.0565 4.50476 17.8199 4.59626 17.5992C4.68775 17.3785
  4.82186 17.178 4.99091 17.0091L5.04545 16.9545C5.25503 16.7403 5.39562 16.4682 5.4491 16.1733C5.50257 15.8784 5.46647 15.5742 5.34545 15.3C5.23022 15.0311 5.03887 14.8018 4.79497
  14.6403C4.55107 14.4788 4.26526 14.3921 3.97273 14.3909H3.81818C3.33597 14.3909 2.87351 14.1994 2.53253 13.8584C2.19156 13.5174 2 13.0549 2 12.5727C2 12.0905 2.19156 11.6281 2.53253
  11.2871C2.87351 10.9461 3.33597 10.7545 3.81818 10.7545H3.9C4.2009 10.7475 4.49273 10.6501 4.73754 10.475C4.98236 10.2999 5.16883 10.0552 5.27273 9.77273C5.39374 9.49853 5.42984 9.19437
  5.37637 8.89947C5.3229 8.60456 5.18231 8.33244 4.97273 8.11818L4.91818 8.06364C4.74913 7.89478 4.61503 7.69425 4.52353 7.47353C4.43203 7.2528 4.38493 7.01621 4.38493 6.77727C4.38493
  6.53834 4.43203 6.30174 4.52353 6.08102C4.61503 5.86029 4.74913 5.65977 4.91818 5.49091C5.08704 5.32186 5.28757 5.18775 5.50829 5.09626C5.72901 5.00476 5.96561 4.95766 6.20455
  4.95766C6.44348 4.95766 6.68008 5.00476 6.9008 5.09626C7.12152 5.18775 7.32205 5.32186 7.49091 5.49091L7.54545 5.54545C7.75971 5.75503 8.03183 5.89562 8.32674 5.9491C8.62164 6.00257
  8.9258 5.96647 9.2 5.84545H9.27273C9.54161 5.73022 9.77093 5.53887 9.93245 5.29497C10.094 5.05107 10.1807 4.76526 10.1818 4.47273V4.31818C10.1818 3.83597 10.3734 3.37351 10.7144
  3.03253C11.0553 2.69156 11.5178 2.5 12 2.5C12.4822 2.5 12.9447 2.69156 13.2856 3.03253C13.6266 3.37351 13.8182 3.83597 13.8182 4.31818V4.4C13.8193 4.69253 13.906 4.97834 14.0676
  5.22224C14.2291 5.46614 14.4584 5.65749 14.7273 5.77273C15.0015 5.89374 15.3056 5.92984 15.6005 5.87637C15.8954 5.8229 16.1676 5.68231 16.3818 5.47273L16.4364 5.41818C16.6052 5.24913
  16.8057 5.11503 17.0265 5.02353C17.2472 4.93203 17.4838 4.88493 17.7227 4.88493C17.9617 4.88493 18.1983 4.93203 18.419 5.02353C18.6397 5.11503 18.8402 5.24913 19.0091 5.41818C19.1781
  5.58704 19.3122 5.78757 19.4037 6.00829C19.4952 6.22901 19.5423 6.46561 19.5423 6.70455C19.5423 6.94348 19.4952 7.18008 19.4037 7.4008C19.3122 7.62152 19.1781 7.82205 19.0091
  7.99091L18.9545 8.04545C18.745 8.25971 18.6044 8.53183 18.5509 8.82674C18.4974 9.12164 18.5335 9.4258 18.6545 9.7V9.77273C18.7698 10.0416 18.9611 10.2709 19.205 10.4324C19.4489 10.594
  19.7347 10.6807 20.0273 10.6818H20.1818C20.664 10.6818 21.1265 10.8734 21.4675 11.2144C21.8084 11.5553 22 12.0178 22 12.5C22 12.9822 21.8084 13.4447 21.4675 13.7856C21.1265 14.1266 20.664
  14.3182 20.1818 14.3182H20.1C19.8075 14.3193 19.5217 14.406 19.2778 14.5676C19.0339 14.7291 18.8425 14.9584 18.7273 15.2273Z" stroke="currentColor" strokeWidth="1.2"
  strokeLinecap="round" strokeLinejoin="round"></path>
</svg>
);

// The workspace's status rack — drawn for the rail (owner's picture: "a server rack
// icon with a small green indicator dot on the top left"). Two states, same dot:
// green = up, red = down (driven by the room; see the header comment).
const WorkspaceStatusIcon = ({ up }: { up: boolean }) => (
  <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" aria-hidden="true" focusable="false">
    <rect x="3" y="3.5" width="14" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.5"></rect>
    <rect x="3" y="11" width="14" height="5.5" rx="1.2" stroke="currentColor" strokeWidth="1.5"></rect>
    <circle cx="6.2" cy="6.25" r="1" fill={up ? "#34D399" : "#F87171"}></circle>
    <path d="M12.5 6.25h3.5M12.5 13.75h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"></path>
  </svg>
);

// Langfuse's own sections, read from web/src/components/layouts/routes.tsx. Its routes are
// project-scoped (/project/<projectId>/...). The id is empty until a project exists (the first
// sign-up creates one); until then project-scoped items land on the app root, which langfuse
// redirects to the organization — the honest behavior for a fresh install.
const LANGFUSE_PROJECT_ID = '51211b35-c875-4715-8040-33fccb624279';
const langfusePath = (suffix: string) =>
  LANGFUSE_PROJECT_ID ? `/project/${LANGFUSE_PROJECT_ID}${suffix}` : '/';

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const ENTRIES = [
  { id: 'lf-home', icon: <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true"><path d="M3 10.5L12 3l9 7.5M5 9.5V21h14V9.5" {...stroke} /></svg>, label: 'Home', path: langfusePath('') },
  { id: 'lf-dashboards', icon: <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true"><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" {...stroke} /></svg>, label: 'Dashboards', path: langfusePath('/dashboards') },
  { id: 'lf-traces', icon: <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true"><path d="M6 3v18M6 8h6M6 15h6M12 5v6M12 12v6" {...stroke} /></svg>, label: 'Traces', path: langfusePath('/traces') },
  { id: 'lf-sessions', icon: <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" {...stroke} /></svg>, label: 'Sessions', path: langfusePath('/sessions') },
  { id: 'lf-prompts', icon: <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true"><path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H8l-4 4V6zM8 8h8M8 11h5" {...stroke} /></svg>, label: 'Prompts', path: langfusePath('/prompts') },
  { id: 'lf-playground', icon: <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" {...stroke} /></svg>, label: 'Playground', path: langfusePath('/playground') },
  { id: 'lf-scores', icon: <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2" {...stroke} /></svg>, label: 'Scores', path: langfusePath('/scores') },
  { id: 'lf-evaluators', icon: <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true"><path d="M12 3l7 3v5c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6zM9 12l2 2 4-4" {...stroke} /></svg>, label: 'Evaluators', path: langfusePath('/evals') },
  { id: 'lf-datasets', icon: <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true"><path d="M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" {...stroke} /></svg>, label: 'Datasets', path: langfusePath('/datasets') },
  { id: 'lf-experiments', icon: <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true"><path d="M9 3h6M10 3v5l-5 8a2 2 0 002 3h10a2 2 0 002-3l-5-8V3M7 14h10" {...stroke} /></svg>, label: 'Experiments', path: langfusePath('/experiments') },
];

interface GovernanceAssemblyRailProps {
  /** Writes a path into the room's embed — the rail's whole wiring. */
  onNavigate?: (path: string) => void;
  /** The room's honest reading: is the workspace standing (frame bound, not down)? */
  toolUp?: boolean;
}

export default function GovernanceAssemblyRail({ onNavigate, toolUp = true }: GovernanceAssemblyRailProps) {
  return (
    <div
      data-lit-id="governance-assembly-rail"
      className="absolute left-0 top-0 bottom-0 w-14 flex flex-col items-center"
      style={{ backgroundColor: '#110E1F', zIndex: 4 }}
    >
      {/* The eight — each one writes its destination into the room's embed. The R's
          old slot is closed; the entries start at the top (owner, 2026-10-07). */}
      <div className="flex flex-col items-center gap-1 pt-3 pb-2">
        {ENTRIES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            title={entry.label}
            aria-label={entry.label}
            onClick={() => onNavigate?.(entry.path)}
            className="w-9 h-9 flex items-center justify-center text-white rounded transition-colors hover:bg-white/10"
          >
            {entry.icon}
          </button>
        ))}
      </div>

      <div className="flex-1" />

      {/* The bottom group of the owner's picture: settings gear + the workspace's status
          rack. The dot is green while the workspace is up and red when the room's clocks
          found it down — a reading, never a decoration. */}
      <div className="flex flex-col items-center gap-1 pb-3">
        <span
          title="Settings"
          aria-label="Settings"
          className="w-9 h-9 flex items-center justify-center text-white"
        >
          <OmSettingsIcon />
        </span>
        <span
          title={toolUp ? 'Governance workspace — up' : 'Governance workspace — down'}
          aria-label="Governance workspace status"
          className="w-9 h-9 flex items-center justify-center text-white"
        >
          <WorkspaceStatusIcon up={toolUp} />
        </span>
      </div>
    </div>
  );
}
