export const DEBUG_ENABLED = true; // set to false before release
 
let box;
const ensureBox = () => {
  if (box || typeof document === 'undefined') return box;
  box = document.createElement('pre');
  Object.assign(box.style, {
    position: 'fixed', left: 0, right: 0, bottom: 0,
    maxHeight: '45vh', overflow: 'auto', margin: 0, padding: '8px',
    background: 'rgba(0,0,0,0.88)', color: '#0f0',
    font: '12px/1.3 monospace', zIndex: 2147483647, whiteSpace: 'pre-wrap',
  });
  box.addEventListener('click', () => { box.textContent = ''; }); // tap panel to clear
  document.body.appendChild(box);
  return box;
};
 
export const debugLog = (label, data) => {
  let text;
  try { text = typeof data === 'string' ? data : JSON.stringify(data, null, 2); }
  catch { text = String(data); }
  console.log(label, data);
  if (!DEBUG_ENABLED) return;
  const el = ensureBox();
  if (!el) return;
  el.textContent = `${new Date().toLocaleTimeString()} ${label}\n${text ?? ''}\n\n${el.textContent}`;
};
 