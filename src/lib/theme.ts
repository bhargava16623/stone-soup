/** Runs before first paint (inlined in <head>) so a saved theme never flashes. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
