current_tab = "game_info_view";

window.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll('[role="tab"]');
  const tabList = document.querySelector('[role="tablist"]');

  tabs.forEach((tab) => {
    tab.addEventListener("click", changeTabs);
  });
});

function changeTabs(e) {
  const target = e.target;
  const parent = target.parentNode.parentNode;
  const grandparent = parent.parentNode.parentNode;

  // Remove all current selected tabs
  parent
    .querySelectorAll('[aria-selected="true"]')
    .forEach((t) => t.setAttribute("aria-selected", false));

  // Set this tab as selected
  target.setAttribute("aria-selected", true);

  // Hide all tab panels
  grandparent
    .querySelectorAll('[role="tabpanel"]')
    .forEach((p) => p.setAttribute("hidden", true));

  // Show the selected panel
  grandparent.parentNode
    .querySelector(`#${target.getAttribute("aria-controls")}`)
    .removeAttribute("hidden");

  current_tab = target.getAttribute('aria-controls');
}
