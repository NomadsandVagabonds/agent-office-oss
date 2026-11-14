// The Backrooms — filling in the blanks. Pure. The words on the signs, plaques
// and banners down here are written with {name}, {agent} and {project} in
// them, and the real office supplies who and what those are: the person who
// fell in, the agents at their desks, the rooms they work in.

/** `text` with its blanks filled from `o` ({ name, agents, projects }); {NAME} and friends shout. R picks which agent or project. */
export const fill = (text, o, R) => String(text)
  .replace(/\{name\}/g, o.name).replace(/\{NAME\}/g, o.name.toUpperCase())
  .replace(/\{agent\}/g, () => R.pick(o.agents)).replace(/\{AGENT\}/g, () => R.pick(o.agents).toUpperCase())
  .replace(/\{project\}/g, () => R.pick(o.projects)).replace(/\{PROJECT\}/g, () => R.pick(o.projects).toUpperCase());

/** Break a line into lines of at most `width` characters, at the spaces. */
export const wrap = (text, width) => {
  const out = [''];
  for (const word of String(text).split(/\s+/)) {
    if ((out[out.length - 1] + ' ' + word).trim().length > width && out[out.length - 1]) out.push(word);
    else out[out.length - 1] = (out[out.length - 1] + ' ' + word).trim();
  }
  return out;
};
