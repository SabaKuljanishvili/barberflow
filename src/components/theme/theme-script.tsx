import { headers } from "next/headers";

export const THEME_KEY = "bf-theme";

// Runs before first paint so the page never flashes the wrong theme:
// the saved choice wins, else the OS preference.
const script = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;

export async function ThemeScript() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  // eslint-disable-next-line react/no-danger -- static script, no user input
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: script }} />;
}
