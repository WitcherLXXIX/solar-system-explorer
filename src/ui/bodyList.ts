import { BODIES, getBody, isSmallBodyKind, type BodyId } from '../catalog/bodies';
import { buildBodyTree, splitNearbyStars, splitSmallBodies, visibleRows } from './bodyTree';
import { el } from './dom';

/**
 * The hierarchical body list: the Sun, planets and dwarf planets at the top level (a chevron expands a body's moons), then a
 * collapsible "Small bodies" group holding the named asteroids and comets (and any trans-Neptunian objects added later).
 */
export function createBodyList(root: HTMLElement, onSelect: (id: BodyId) => void): { setActive(id: BodyId): void } {
  const { main: withoutSmall, small } = splitSmallBodies(BODIES);
  const { main, stars } = splitNearbyStars(withoutSmall);
  const tree = buildBodyTree(main);
  const expanded = new Set<BodyId>();
  let smallOpen = false;
  let starsOpen = false;
  let active: BodyId | null = null;

  const bodyButton = (id: BodyId): HTMLElement => {
    const button = el('button', id === active ? 'body-btn active' : 'body-btn', getBody(id).name);
    button.addEventListener('click', () => onSelect(id));
    return button;
  };

  const render = (): void => {
    const lines = visibleRows(tree, expanded).map((row) => {
      const name = getBody(row.id).name;
      const line = el('div', 'body-row');
      line.style.paddingLeft = `${row.depth * 14}px`;
      if (row.hasChildren) {
        const toggle = el('button', 'chevron', row.expanded ? '▾' : '▸');
        toggle.setAttribute('aria-expanded', String(row.expanded));
        toggle.setAttribute('aria-label', `${row.expanded ? 'Collapse' : 'Expand'} the moons of ${name}`);
        toggle.addEventListener('click', () => {
          if (expanded.has(row.id)) expanded.delete(row.id);
          else expanded.add(row.id);
          render();
        });
        line.append(toggle);
      } else {
        line.append(el('span', 'chevron-space'));
      }
      line.append(bodyButton(row.id));
      return line;
    });

    const group = (label: string, noun: string, open: boolean, toggle: () => void, members: readonly { id: BodyId }[]): void => {
      const header = el('div', 'body-row');
      const groupToggle = el('button', 'group-toggle', `${open ? '▾' : '▸'} ${label} (${members.length})`);
      groupToggle.setAttribute('aria-expanded', String(open));
      groupToggle.setAttribute('aria-label', `${open ? 'Hide' : 'Show'} the ${noun}`);
      groupToggle.addEventListener('click', () => {
        toggle();
        render();
      });
      header.append(groupToggle);
      lines.push(header);
      if (!open) return;
      for (const body of members) {
        const line = el('div', 'body-row');
        line.style.paddingLeft = '14px';
        line.append(el('span', 'chevron-space'), bodyButton(body.id));
        lines.push(line);
      }
    };
    group('Small bodies', 'small bodies', smallOpen, () => { smallOpen = !smallOpen; }, small);
    group('Nearby stars', 'nearby stars', starsOpen, () => { starsOpen = !starsOpen; }, stars);
    root.replaceChildren(...lines);
  };
  render();

  return {
    setActive(id) {
      active = id;
      const body = getBody(id);
      if (body.kind === 'moon' && body.parent) expanded.add(body.parent); // show the focused moon's siblings
      if (isSmallBodyKind(body.kind)) smallOpen = true; // show the focused small body's group
      if (body.kind === 'nearstar') starsOpen = true; // show the focused star's group
      render();
    },
  };
}
