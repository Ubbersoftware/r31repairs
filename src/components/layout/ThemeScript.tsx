export function ThemeScript() {
  const js = `(function(){try{var t=localStorage.getItem('r31-theme');if(!t){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}})();`
  return <script dangerouslySetInnerHTML={{ __html: js }} />
}
