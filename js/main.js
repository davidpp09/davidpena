import { initPedidos } from './pedidos.js';
import { initRag } from './rag.js';
import { initTicket } from './ticket.js';
import { initCrm } from './crm.js';

const tabs = [...document.querySelectorAll('.tab[role="tab"]')];
function activate(tab) {
  tabs.forEach((item) => {
    const active = item === tab;
    item.setAttribute('aria-selected', String(active));
    item.tabIndex = active ? 0 : -1;
    document.getElementById(item.getAttribute('aria-controls')).hidden = !active;
  });
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => activate(tab));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const next = tabs[(index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
    activate(next);
    next.focus();
  });
});
const fromHash = () => tabs.find((tab) => `#${tab.getAttribute('aria-controls')}` === window.location.hash);
activate(fromHash() || tabs[0]);
window.addEventListener('hashchange', () => { if (fromHash()) activate(fromHash()); });
initPedidos(document.getElementById('demo-pedidos'));
initRag(document.getElementById('demo-rag'));
initTicket(document.getElementById('demo-ticket'));
initCrm(document.getElementById('demo-crm'));
