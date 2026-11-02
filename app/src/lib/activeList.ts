/**
 * The list a drawer was opened from. A table that has an open row records its rows here,
 * in the order it shows them, so the drawer can step to the previous or next row.
 */
export type ActiveList = { owner: object; ids: string[]; active: string; open: (id: string) => void; noun: string };

let current: ActiveList | null = null;

export const setActiveList = (l: ActiveList | null, owner: object) => {
  if (l) current = l;
  else if (current && current.owner === owner) current = null;
};

export const getActiveList = () => current;
