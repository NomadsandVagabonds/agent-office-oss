// The Office — the characters. This is the 2D office's character art, ported
// call for call from p5 to Pix, split into the body parts that move on their
// own (legs, torso, arms, head). Each part is painted from the front AND from
// the back, with a depth for every stroke — so the same drawing is a flat
// sprite when you want one and a posable little sculpture when you don't.
//
// Drawing space is the original's: origin between the feet, y down, the head
// is the 8×9 block at y −27…−18, the whole figure is about 30 px tall.
import { Pix, shade } from './pix.js';
import { PAL } from './palette.js';
import { drawCustom } from './items.js';

const HD = 4;                       // half the depth of a skull (8 px front to back)
export const CHAR_PX = 0.05;        // one character pixel in metres (30 px ≈ 1.5 m)
export const PIVOT = Object.freeze({
  legL: { x: -2.5, y: -7 }, legR: { x: 2.5, y: -7 },
  torso: { x: 0, y: -7 },
  armL: { x: -5.5, y: -15.5 }, armR: { x: 5.5, y: -15.5 },
  head: { x: 0, y: -18 },
  hand: { x: 5.5, y: -5.5 },        // where a held thing sits, relative to the figure
});

function eyes(g, skS, open) {
  if (open) {
    g.fill('#fbf3e2'); g.rect(-3, -23, 3, 3); g.rect(1, -23, 3, 3);
    g.fill('#2a211a'); g.rect(-2, -23, 2, 2); g.rect(2, -23, 2, 2);
    g.fill('#fff'); g.rect(-2, -23, 1, 1);
  } else {
    g.fill(skS); g.rect(-3, -22, 3, 1); g.rect(1, -22, 3, 1);
  }
}

function paintHoops(g, color = '#e2989e', glint = '#f6d58e') {
  g.z(-0.8, 1.4);
  g.fill(color);
  // Left open hoop ring beside cheek
  g.rect(-7, -21, 1, 3); g.rect(-5, -21, 1, 3);
  g.rect(-6, -22, 1, 1); g.rect(-6, -18, 1, 1);
  // Right open hoop ring beside cheek
  g.rect(4, -21, 1, 3); g.rect(6, -21, 1, 3);
  g.rect(5, -22, 1, 1); g.rect(5, -18, 1, 1);
  g.fill(glint);
  g.rect(-7, -21, 1, 1); g.rect(6, -21, 1, 1);
}

function paintHeadFront(g, L, o) {
  const sk = L.skin, skS = shade(sk, -26), skH = shade(sk, 18);
  const hc = L.hairColor, hcH = shade(hc, 30), hcS = shade(hc, -28);
  const oc = L.outfitColor;
  const open = !o.blink;
  if (L.species === 'robot') {
    g.z(-HD, HD);
    g.fill(PAL.steelS); g.rect(-4, -27, 8, 9);
    g.fill(PAL.steel); g.rect(-4, -27, 7, 9);
    g.fill(PAL.steelH); g.rect(-4, -27, 7, 2);
    g.fill('#1c2630'); g.rect(-3, -25, 6, 5);
    g.fill(o.blocked ? PAL.warn : PAL.good);
    if (open) { g.rect(-2, -24, 2, 2); g.rect(1, -24, 2, 2); }
    g.z(-1, 1);
    g.fill(PAL.steelS); g.rect(-1, -30, 2, 3);
    g.fill(PAL.warn); g.rect(-1, -31, 2, 2);
    g.fill('#fff'); g.rect(-1, -31, 1, 1);
  } else if (L.species === 'alien') {
    // Dark corded neck + bulbous furrowed cranium tapering to chiseled jaw
    g.z(-2.2, 2.2);
    g.fill('#22242a'); g.rect(-2, -19, 4, 3);
    g.fill(shade(sk, -42)); g.rect(-1, -19, 1, 3); g.rect(1, -19, 1, 2);
    g.z(-HD, HD);
    // Sleek tapered cranium + narrow chiseled lower jaw (no protruding ear flaps)
    g.fill(skS); g.rect(-5, -29, 10, 5); g.rect(-4, -31, 8, 2); g.rect(-4, -24, 8, 4); g.rect(-3, -20, 6, 2);
    g.fill(sk); g.rect(-5, -29, 8, 5); g.rect(-4, -31, 6, 2); g.rect(-4, -24, 7, 4); g.rect(-3, -20, 5, 2);
    g.fill(skH); g.rect(-4, -31, 5, 1); g.rect(-5, -29, 3, 1); g.rect(-2, -20, 3, 1);
    // Organic V-furrows on brow
    g.fill(skS);
    g.rect(-4, -30, 2, 1); g.rect(2, -30, 2, 1);
    g.rect(-2, -28, 4, 1);
    // Slit nostrils & stoic mouth crease
    g.z(HD, HD + 0.6);
    g.fill('#2b1c0a'); g.rect(-1, -22, 1, 2); g.rect(1, -22, 1, 2);
    g.fill('#3b270d'); g.rect(-2, -20, 4, 1);
    // Glossy obsidian alien eyes (shown whenever not covered by goggles)
    g.z(-HD, HD);
    if (open) {
      g.fill('#111318'); g.rect(-4, -25, 3, 3); g.rect(1, -25, 3, 3);
      g.fill('#dfe8f4'); g.rect(-4, -25, 1, 1); g.rect(1, -25, 1, 1);
    } else {
      g.fill(skS); g.rect(-4, -24, 3, 1); g.rect(1, -24, 3, 1);
    }
    // Optional wigs/hats if chosen over alien cranium
    if (L.hair && L.hair !== 'bald') {
      g.z(-HD - 0.6, HD + 0.6); g.fill(hc);
      if (L.hair === 'cap') {
        g.fill(oc); g.rect(-6, -32, 12, 4);
        g.z(HD + 0.6, HD + 4.4); g.fill(shade(oc, -14)); g.rect(-5, -29, 10, 1);
      } else if (L.hair === 'beanie') {
        g.fill(oc); g.rect(-6, -34, 12, 6);
        g.fill(shade(oc, -26)); g.rect(-6, -29, 12, 2);
      } else if (L.hair === 'mohawk') {
        g.rect(-1, -35, 3, 6);
      } else if (L.hair === 'bun') {
        g.zAuto(7); g.ellipse(0, -34, 7, 7);
      } else {
        g.rect(-6, -32, 12, 3);
      }
    }
  } else {
    g.z(-HD, HD);
    g.fill(skS); g.rect(-4, -27, 8, 9);
    g.fill(sk); g.rect(-4, -27, 6, 9);
    g.fill(skH); g.rect(-4, -27, 6, 2);
    if (L.species === 'goblin') {
      g.z(-0.8, 0.8);
      g.fill(sk); g.triangle(-4, -25, -9, -28, -4, -20); g.triangle(4, -25, 9, -28, 4, -20);
      g.fill(skS); g.triangle(4, -25, 9, -28, 4, -23);
      g.z(HD, HD + 1.4); g.fill(shade(sk, -34)); g.rect(-1, -21, 3, 3);
      g.z(-HD, HD); eyes(g, skS, open);
      g.z(HD - 1, HD + 0.6); g.fill('#f3ead2'); g.rect(1, -18, 2, 1);
    } else if (L.species === 'dog') {
      g.z(-2, 2); g.fill(shade(sk, -30)); g.rect(-6, -28, 3, 6); g.rect(3, -28, 3, 6);
      g.z(HD, HD + 2.2); g.fill(sk); g.rect(-2, -21, 5, 4);
      g.fill('#1f1812'); g.rect(0, -20, 3, 2);
      g.z(-HD, HD);
      if (open) {
        g.fill('#fbf3e2'); g.rect(-3, -25, 3, 3); g.rect(2, -25, 3, 3);
        g.fill('#2a211a'); g.rect(-2, -25, 2, 2); g.rect(3, -25, 2, 2);
      } else { g.fill(skS); g.rect(-3, -24, 3, 1); g.rect(2, -24, 3, 1); }
    } else if (L.species === 'cat') {
      g.z(-1.2, 1.2);
      g.fill(sk); g.triangle(-4, -26, -5, -32, 0, -26); g.triangle(4, -26, 5, -32, 0, -26);
      g.fill(shade(sk, -30)); g.triangle(-3, -27, -4, -30, -1, -27);
      g.z(-HD, HD); eyes(g, skS, open);
      g.z(HD - 0.4, HD + 0.3);
      g.stroke(skS); g.strokeWeight(0.6); g.line(-4, -21, -9, -22); g.line(4, -21, 9, -22); g.noStroke();
      g.z(HD, HD + 0.6); g.fill('#ee8888'); g.rect(-1, -21, 2, 1);
    } else {
      eyes(g, skS, open);
      g.fill(skS); g.rect(-1, -22, 1, 2);
    }
    // hair
    g.z(-HD - 0.6, HD + 0.6);
    g.fill(hc);
    if (L.hair === 'short') { g.rect(-5, -29, 10, 5); g.fill(hcH); g.rect(-5, -29, 8, 1); }
    else if (L.hair === 'side') { g.rect(-5, -29, 10, 4); g.rect(-5, -29, 3, 9); g.fill(hcH); g.rect(-4, -28, 1, 7); }
    else if (L.hair === 'long') {
      g.rect(-6, -30, 12, 4); g.rect(-7, -29, 3, 14); g.rect(4, -29, 3, 14);
      g.fill(hcH); g.rect(-6, -29, 1, 12);
    } else if (L.hair === 'braids') {
      // parted crown + flowing right wave + banded left side-tail & square gold clip
      g.rect(-6, -30, 12, 3);
      g.rect(-8, -28, 4, 4); g.rect(4, -28, 4, 4);
      g.rect(4, -25, 4, 6); g.rect(5, -20, 3, 6);
      g.rect(-9, -25, 4, 8);
      g.fill(hcH); g.rect(-8, -26, 1, 6); g.rect(5, -26, 1, 7);
      g.fill('#e2bd5a'); g.rect(-9, -23, 2, 2);
      g.fill(hcS); g.rect(-9, -17, 4, 2);
      g.fill(hc); g.rect(-10, -15, 4, 4); g.rect(-11, -13, 3, 2);
      g.fill(hcH); g.rect(-9, -15, 1, 3);
    } else if (L.hair === 'bun') {
      g.rect(-5, -29, 10, 3);
      g.zAuto(7); g.ellipse(0, -32, 7, 7); g.fill(hcH); g.ellipse(-1, -33, 3, 3);
    } else if (L.hair === 'mohawk') { g.rect(-4, -29, 8, 2); g.z(-HD - 0.6, HD + 0.6); g.rect(-1, -34, 3, 8); g.fill(hcH); g.rect(-1, -34, 1, 7); }
    else if (L.hair === 'cap') {
      g.fill(oc); g.rect(-5, -30, 10, 4);
      g.fill(shade(oc, 28)); g.rect(-5, -30, 8, 1);
      g.z(HD + 0.6, HD + 4.4); g.fill(shade(oc, -14)); g.rect(-4, -27, 8, 1);       // the brim points forward
    } else if (L.hair === 'beanie') {
      g.fill(oc); g.rect(-5, -32, 10, 6);
      g.fill(shade(oc, -26)); g.rect(-5, -27, 10, 2);
      g.fill(shade(oc, 30)); g.rect(-4, -31, 2, 4);
    }
    if (L.facial === 'mustache') { g.z(HD, HD + 0.7); g.fill(hc); g.rect(-3, -20, 6, 2); }
    else if (L.facial === 'beard') {
      g.z(HD - 1.4, HD + 0.7);
      g.fill(hc); g.rect(-4, -22, 8, 5);
      g.fill(hcH); g.rect(-4, -22, 8, 1);
      g.fill(sk); g.rect(-2, -22, 4, 2);
    } else if (L.facial === 'lashes') {
      paintHoops(g, '#e58ea6', '#ffdbe6');
      g.z(HD, HD + 0.7);
      if (open && L.species !== 'dog' && L.species !== 'cat') {
        g.fill('#221816'); g.rect(-4, -23, 1, 1); g.rect(4, -23, 1, 1);
        g.fill('#5a3836'); g.rect(-3, -25, 2, 1); g.rect(2, -25, 2, 1);
      }
      if (L.species !== 'dog' && L.species !== 'cat') {
        g.fill('#c95266'); g.rect(-1, -19, 3, 1);
        g.fill('#e88396'); g.rect(0, -19, 1, 1);
      }
    }
  }
  paintAccessory(g, L, o);
}

function paintAccessory(g, L, o) {
  const acc = L.accessory;
  if (!acc || acc === 'none') return;
  g.noStroke();
  if (acc === 'glasses') {
    g.z(HD, HD + 0.8);
    g.fill('#1c1812'); g.rect(-4, -24, 4, 4); g.rect(1, -24, 4, 4); g.rect(-1, -23, 2, 1);
    g.fill('#bcd6e6'); g.rect(-3, -23, 1, 1); g.rect(2, -23, 1, 1);
  } else if (acc === 'monocle') {
    g.z(HD, HD + 0.7);
    g.noFill(); g.stroke('#e8c45a'); g.strokeWeight(0.7); g.ellipse(2, -22, 4, 4); g.noStroke();
    g.fill('#dff0f7'); g.rect(1, -23, 1, 1);
    g.stroke('#caa24a'); g.strokeWeight(0.5); g.line(3, -20, 4, -14); g.noStroke();
  } else if (acc === 'headphones') {
    g.z(-1.6, 1.6);
    g.fill('#33303a'); g.rect(-7, -26, 3, 6); g.rect(4, -26, 3, 6);
    g.fill('#4a4654'); g.rect(-7, -26, 3, 1); g.rect(4, -26, 3, 1);
    g.noFill(); g.stroke('#33303a'); g.strokeWeight(2); g.arc(0, -27, 14, 11, 3.4, 6.0); g.noStroke();
  } else if (acc === 'halo') {
    // a ring lying flat above the head: front arc, back arc, and the two ends
    g.fill(PAL.warn);
    g.z(2.2, 3.4); g.rect(-4, -34, 8, 1);
    g.z(-3.4, -2.2); g.back(true); g.rect(-4, -34, 8, 1); g.back(false);
    g.z(-2.2, 2.2); g.rect(-6, -34, 2, 1); g.rect(4, -34, 2, 1);
    g.fill('#fff3c0'); g.z(3.4, 3.6); g.rect(-3, -34, 3, 1);
  } else if (acc === 'partyhat') {
    g.zAuto(10);
    g.fill('#e0705f'); g.triangle(-5, -29, 5, -29, 0, -40);
    g.fill('#f0d24b'); g.triangle(-4, -30, 4, -30, 1, -35);
    g.fill('#ffffff'); g.zAuto(3); g.ellipse(0, -41, 3, 3);
  } else if (acc === 'crown') {
    g.zAuto(10);
    g.fill('#e8c45a'); g.rect(-5, -31, 11, 3);
    g.triangle(-5, -31, -2, -31, -3.5, -35); g.triangle(-1.5, -31, 2, -31, 0, -36); g.triangle(2.5, -31, 5.5, -31, 4, -35);
    g.fill('#e0705f'); g.rect(-1, -31, 2, 2);
  } else if (acc === 'tophat') {
    g.zAuto(12); g.fill('#1c1c22'); g.rect(-7, -30, 15, 2);
    g.zAuto(10); g.rect(-5, -39, 11, 9);
    g.fill('#8a3a4a'); g.rect(-5, -32, 11, 2);
  } else if (acc === 'flower') {
    g.z(-1, 1);
    g.fill('#3f6638'); g.rect(5, -26, 1, 4);
    g.fill('#e87aae'); g.ellipse(5, -28, 3, 3); g.ellipse(7, -27, 3, 3); g.ellipse(5, -25, 3, 3); g.ellipse(3, -27, 3, 3);
    g.z(1, 1.6); g.fill('#f0d24b'); g.rect(4, -28, 2, 2);
  } else if (acc === 'eyepatch') {
    g.z(HD, HD + 0.7);
    g.fill('#161616'); g.rect(0, -24, 4, 4);
    g.stroke('#161616'); g.strokeWeight(1); g.line(-4, -26, 5, -22); g.noStroke();
  } else if (acc === 'shades') {
    g.z(HD, HD + 0.8);
    g.fill('#141414'); g.rect(-4, -24, 9, 2); g.rect(-4, -24, 4, 4); g.rect(1, -24, 4, 4);
    g.fill('#3a5a6a'); g.rect(-3, -23, 1, 1); g.rect(2, -23, 1, 1);
  } else if (acc === 'propeller') {
    g.zAuto(10);
    g.fill('#d8493f'); g.rect(-5, -30, 11, 3);
    g.fill('#3f7f9a'); g.rect(-5, -29, 11, 2);
    g.z(-0.7, 0.7); g.fill('#5a5a66'); g.rect(-1, -34, 2, 4);
    if (!o.noBlades) {
      g.z(-1, 1); g.fill('#e8c45a'); g.rect(-6, -36, 5, 2); g.rect(1, -36, 5, 2);
    }
  } else if (acc === 'cowboy') {
    // Tapered cattleman crown with center pinch + crimson ribbon band + wide curved brim
    g.zAuto(10);
    g.fill('#bfa77a'); g.rect(-6, -36, 12, 6);
    g.rect(-5, -38, 4, 2); g.rect(1, -38, 4, 2);
    g.fill('#9e865c'); g.rect(-1, -37, 2, 2);
    g.fill('#d4be92'); g.rect(-5, -38, 3, 1); g.rect(1, -38, 2, 1); g.rect(-6, -36, 2, 4);
    g.fill('#b53f38'); g.rect(-6, -32, 12, 2);
    g.fill('#ddb65c'); g.rect(4, -32, 2, 2);
    g.zAuto(14);
    g.fill('#bfa77a'); g.rect(-10, -30, 20, 2);
    g.rect(-11, -31, 3, 2); g.rect(8, -31, 3, 2);
    g.fill('#d4be92'); g.rect(-12, -32, 2, 2); g.rect(10, -32, 2, 2); g.rect(-9, -30, 18, 1);
    g.fill('#9a8258'); g.rect(-9, -28, 18, 1);
  } else if (acc === 'hoops') {
    paintHoops(g, '#e8c45a', '#fff3c0');
  } else if (acc === 'goggles') {
    const gy = L.species === 'alien' ? -27 : -25;
    g.z(HD, HD + 1.4);
    // Side silver straps + bridge
    g.fill('#69717e'); g.rect(-7, gy + 2, 14, 2);
    // Circular brushed-silver rims
    g.fill('#949ca9');
    g.rect(-6, gy + 1, 5, 4); g.rect(-5, gy, 3, 6);
    g.rect(1, gy + 1, 5, 4); g.rect(2, gy, 3, 6);
    g.fill('#cbd2de');
    g.rect(-5, gy, 3, 1); g.rect(2, gy, 3, 1); g.rect(-1, gy + 2, 2, 1);
    // Deep glossy black convex lenses + sky glint
    g.fill('#111318');
    g.rect(-5, gy + 1, 3, 4); g.rect(2, gy + 1, 3, 4);
    g.fill('#dfe8f4');
    g.rect(-5, gy + 1, 1, 1); g.rect(2, gy + 1, 1, 1);
    g.fill('#5d6f86');
    g.rect(-4, gy + 1, 1, 1); g.rect(3, gy + 1, 1, 1);
  } else if (o.creations && o.creations[acc] && o.creations[acc].kind === 'hat') {
    g.zAuto(8);
    drawCustom(g, o.creations[acc], 0, -30, 0);
  }
}

function paintHeadBack(g, L) {
  const sk = L.skin, skS = shade(sk, -26);
  const hc = L.hairColor, hcS = shade(hc, -22), hcH = shade(hc, 26);
  const oc = L.outfitColor;
  g.back(true);
  g.z(-HD - 0.6, -0.4);
  if (L.species === 'robot') {
    g.fill(PAL.steel); g.rect(-4, -27, 7, 9);
    g.fill(PAL.steelS); g.rect(-2, -25, 4, 5);
    g.z(-1, 1);
    g.fill(PAL.steelS); g.rect(-1, -30, 2, 3);
    g.fill(PAL.warn); g.rect(-1, -31, 2, 2);
    g.back(false);
    return;
  }
  if (L.species === 'alien') {
    g.fill('#22242a'); g.rect(-2, -19, 4, 3);
    g.fill(skS); g.rect(-5, -29, 10, 6); g.rect(-4, -31, 8, 2); g.rect(-4, -23, 8, 4);
    g.fill(sk); g.rect(-5, -29, 8, 6); g.rect(-4, -31, 6, 2); g.rect(-4, -23, 7, 4);
    g.fill(shade(sk, 16)); g.rect(-4, -31, 5, 1);
    g.fill(skS); g.rect(-4, -28, 8, 1); g.rect(-4, -25, 8, 1);
    if (L.accessory === 'goggles') {
      g.fill('#69717e'); g.rect(-5, -25, 10, 1);
    }
    if (L.accessory === 'cowboy') {
      g.z(-7, -3);
      g.fill('#b53f38'); g.rect(-6, -32, 12, 2);
      g.fill('#bfa77a'); g.rect(-10, -30, 20, 2);
    }
    g.back(false);
    return;
  }
  g.fill(sk); g.rect(-4, -27, 7, 4);
  if (L.hair === 'bald') {
    g.fill(sk); g.rect(-4, -27, 8, 7);
    g.fill(shade(sk, 16)); g.rect(-4, -27, 7, 2);
  } else if (L.hair === 'cap') {
    g.fill(oc); g.rect(-5, -29, 10, 6);
    g.fill(shade(oc, 28)); g.rect(-5, -29, 8, 1);
    g.fill(shade(oc, -20)); g.rect(-2, -23, 4, 2);
  } else if (L.hair === 'beanie') {
    g.fill(oc); g.rect(-5, -32, 10, 9);
    g.fill(shade(oc, -26)); g.rect(-5, -24, 10, 2);
  } else if (L.hair === 'braids') {
    g.fill(hc); g.rect(-7, -29, 14, 12);
    g.rect(-10, -19, 4, 6); g.rect(4, -19, 4, 4);
    g.fill(hcH); g.rect(-5, -28, 9, 2);
    g.fill(hcS); g.rect(-9, -17, 4, 2); g.rect(-6, -18, 12, 1);
    g.fill(hc); g.rect(-11, -15, 4, 4);
  } else {
    g.fill(hc); g.rect(-5, -29, 10, 9);
    if (L.hair === 'long') g.rect(-6, -29, 12, 13);
    if (L.hair === 'mohawk') { g.fill(skS); g.rect(-5, -27, 10, 7); g.fill(hc); g.rect(-1, -32, 3, 9); }
    g.fill(hcH); g.rect(-4, -28, 7, 2);
    g.fill(hcS); g.rect(-4, -20, 8, 1);
  }
  if (L.accessory === 'cowboy') {
    g.z(-7, -3);
    g.fill('#b53f38'); g.rect(-6, -32, 12, 2);
    g.fill('#bfa77a'); g.rect(-10, -30, 20, 2);
    g.fill('#9a8258'); g.rect(-9, -28, 18, 1);
  }
  g.back(false);
}

function paintTorso(g, L) {
  const oc = L.outfitColor, ocS = shade(oc, -30), ocH = shade(oc, 26);
  const sk = L.skin, skS = shade(sk, -30);
  g.z(-3, 3);
  g.fill(ocS); g.rect(-5, -18, 10, 12);
  g.fill(oc); g.rect(-5, -18, 8, 12);
  g.fill(ocH); g.rect(-5, -18, 8, 2);
  if (L.outfit === 'hoodie') {
    g.fill(ocS); g.rect(-5, -18, 10, 3);
    g.fill(skS); g.rect(-1, -16, 2, 2);
    g.fill(ocS); g.rect(0, -10, 1, 8);
  } else if (L.outfit === 'suit') {
    g.fill('#ece5d4'); g.rect(-2, -18, 4, 9);
    g.fill(ocS); g.triangle(-3, -18, 3, -18, 0, -11);
    g.fill('#2a211a'); g.rect(-1, -15, 2, 5);
  } else if (L.outfit === 'vest') {
    g.fill(ocH); g.rect(-3, -16, 6, 9);
    g.fill('#2a211a'); g.rect(0, -15, 1, 7);
  } else if (L.outfit === 'cardigan') {
    g.fill(ocS); g.rect(-5, -18, 2, 12); g.rect(3, -18, 2, 12);
    g.fill(ocH); g.rect(-1, -17, 2, 11);
  } else if (L.outfit === 'tunic') {
    // Wholesome tailored halter-neck bodice + collarbone straps + glossy choker
    g.fill(sk); g.rect(-5, -18, 10, 2);
    g.fill(oc); g.rect(-4, -18, 2, 3); g.rect(2, -18, 2, 3);
    g.fill(ocH); g.rect(-4, -16, 8, 1);
    g.fill(ocS); g.rect(-3, -15, 1, 7); g.rect(2, -15, 1, 7);
    g.fill(shade(oc, -18)); g.rect(-3, -18, 6, 1);
    g.fill('#fcebf2'); g.rect(-2, -18, 2, 1);
  } else if (L.outfit === 'consul') {
    // Striped slate-blue shirt V + patterned gold/slate silk tie + notched lapels + circular chest vent
    g.fill('#688198'); g.rect(-2, -18, 4, 9);
    g.fill('#9cb3c7'); g.rect(-3, -18, 2, 2); g.rect(1, -18, 2, 2); g.rect(-2, -15, 4, 1); g.rect(-2, -13, 4, 1);
    if (L.species === 'alien') { g.fill('#22242a'); g.rect(-1, -18, 2, 1); }
    g.fill(ocH); g.rect(-4, -18, 1, 7); g.rect(3, -18, 1, 7);
    g.fill(ocS); g.rect(-3, -16, 1, 6); g.rect(2, -16, 1, 6);
    g.fill('#d4a138'); g.rect(-1, -17, 2, 7);
    g.fill('#3c4654'); g.rect(-1, -15, 2, 1); g.rect(0, -13, 1, 2);
    // Welt pocket & circular silver-rimmed dark vent badge on lower-left chest
    g.fill(ocS); g.rect(2, -13, 3, 1);
    g.fill('#9aa2b0'); g.rect(2, -10, 3, 3);
    g.fill('#1b1e24'); g.rect(3, -9, 1, 1);
  }
  g.fill(ocS); g.rect(-5, -8, 10, 2);
  if (L.outfit === 'tunic') { g.fill(ocH); g.rect(-1, -8, 2, 1); }
  // the back: plain cloth, a seam down the spine, a collar
  g.back(true);
  g.fill(oc); g.rect(-5, -18, 8, 12);
  g.fill(ocH); g.rect(-5, -18, 8, 2);
  g.fill(ocS); g.rect(-1, -18, 1, 12);
  g.fill(shade(oc, -12)); g.rect(-5, -17, 10, 1);
  if (L.outfit === 'tunic') {
    g.fill(ocS); g.rect(-5, -18, 10, 12);
    g.fill(oc); g.rect(-5, -18, 8, 12);
    g.fill(sk); g.rect(-5, -18, 10, 2);
    g.fill(oc); g.rect(-4, -18, 2, 2); g.rect(2, -18, 2, 2);
    g.fill(ocH); g.rect(-4, -16, 8, 1);
    g.fill(ocS); g.rect(-1, -15, 1, 7);
    g.fill(shade(oc, -18)); g.rect(-3, -18, 6, 1);
  }
  g.fill(ocS); g.rect(-5, -8, 10, 2);
  g.back(false);
}

/**
 * Paint a whole character as separate parts.
 * @param {object} look  resolved look (core/look.mjs resolveLook)
 * @param {{blink?:boolean, blocked?:boolean, creations?:object, voxel?:boolean, noBlades?:boolean}} [opt]
 * @returns {{legL:Pix, legR:Pix, torso:Pix, armL:Pix, armR:Pix, head:Pix}}
 */
export function paintCharacter(look, opt = {}) {
  const L = look;
  const robot = L.species === 'robot';
  const sk = robot ? PAL.steel : L.skin;
  const oc = L.outfitColor;
  const ocS = shade(oc, -30), ocH = shade(oc, 24);
  const tunic = L.outfit === 'tunic';
  const consul = L.outfit === 'consul';
  const sleeveC = tunic ? shade(sk, -10) : consul ? shade(oc, -14) : ocS;
  const pantC = tunic ? '#37334a' : consul ? '#272b34' : '#2c251c';
  const pantHi = tunic ? '#494462' : consul ? '#363c48' : '#3a3128';
  const mk = (b) => { const g = new Pix(b); g.voxel = !!opt.voxel; g.noStroke(); return g; };

  const legL = mk({ x0: -5, y0: -8, x1: 0, y1: 1 });
  legL.z(-2, 2); legL.fill(pantC); legL.rect(-4, -7, 3, 7); legL.fill(pantHi); legL.rect(-4, -7, 1, 7);
  if (tunic) { legL.fill('#a8895e'); legL.rect(-4, -2, 3, 2); }
  const legR = mk({ x0: 0, y0: -8, x1: 5, y1: 1 });
  legR.z(-2, 2); legR.fill(pantC); legR.rect(1, -7, 3, 7);
  if (tunic) { legR.fill('#a8895e'); legR.rect(1, -2, 3, 2); }

  const torso = mk({ x0: -6, y0: -19, x1: 6, y1: -5 });
  paintTorso(torso, L);

  const armL = mk({ x0: -8, y0: -17, x1: -3, y1: -3 });
  armL.z(-1.6, 1.6); armL.fill(sleeveC); armL.rect(-7, -16, 3, 10);
  if (tunic) { armL.fill(oc); armL.rect(-7, -10, 3, 3); armL.fill(ocH); armL.rect(-7, -10, 3, 1); }
  armL.fill(sk); armL.rect(-7, -7, 3, 3);

  const armR = mk({ x0: 3, y0: -17, x1: 8, y1: -3 });
  armR.z(-1.6, 1.6); armR.fill(sleeveC); armR.rect(4, -16, 3, 10);
  if (tunic) { armR.fill(oc); armR.rect(4, -10, 3, 3); armR.fill(ocH); armR.rect(4, -10, 3, 1); }
  armR.fill(sk); armR.rect(4, -7, 3, 3);

  const head = mk({ x0: -14, y0: -62, x1: 14, y1: -9 });
  paintHeadFront(head, L, opt);
  paintHeadBack(head, L);

  return { legL, legR, torso, armL, armR, head };
}

/** A coffee mug, for the idle sip. */
export function paintMug() {
  const g = new Pix({ x0: -4, y0: -6, x1: 5, y1: 1 });
  g.voxel = true; g.noStroke();
  g.zAuto(5);
  g.fill('#cf6b4b'); g.rect(-3, -4, 5, 4);
  g.fill('#e88a6a'); g.rect(-3, -4, 5, 1);
  g.z(-0.6, 0.6); g.fill('#cf6b4b'); g.rect(2, -3, 2, 2);
  return g;
}

/** Arms as the 2D office draws them for each pose (flat sprites only). */
function paintArmsFlat(g, L, pose, t = 0) {
  const robot = L.species === 'robot';
  const sk = robot ? PAL.steel : L.skin;
  const oc = L.outfitColor;
  const ocS = shade(oc, -30), ocH = shade(oc, 24);
  const tunic = L.outfit === 'tunic';
  const sleeveC = tunic ? shade(sk, -10) : L.outfit === 'consul' ? shade(oc, -14) : ocS;
  g.noStroke();
  if (pose === 'typing') {
    const ty = Math.sin(t * 16) * 1.6;
    g.fill(sleeveC); g.rect(-7, -23, 3, 10); g.rect(4, -23, 3, 10);
    if (tunic) { g.fill(oc); g.rect(-7, -21, 3, 3); g.rect(4, -21, 3, 3); }
    g.fill(sk); g.rect(-7, -24 + ty, 3, 3); g.rect(4, -24 - ty, 3, 3);
  } else if (pose === 'blocked') {
    const wave = Math.sin(t * 12) * 0.9;
    g.push(); g.translate(5, -16); g.rotate(-1.1 + wave);
    g.fill(sleeveC); g.rect(0, 0, 3, 10);
    if (tunic) { g.fill(oc); g.rect(0, 6, 3, 3); }
    g.fill(sk); g.rect(0, 9, 3, 4); g.pop();
    g.fill(sleeveC); g.rect(-7, -16, 3, 10);
    if (tunic) { g.fill(oc); g.rect(-7, -10, 3, 3); }
    g.fill(sk); g.rect(-7, -8, 3, 4);
  } else if (pose === 'sip') {
    const sp = Math.sin(t * 1.3) * 1.4;
    g.fill(sleeveC); g.rect(-7, -16, 3, 10);
    if (tunic) { g.fill(oc); g.rect(-7, -10, 3, 3); g.fill(ocH); g.rect(-7, -10, 3, 1); }
    g.fill(sk); g.rect(-7, -7, 3, 3);
    g.fill(sleeveC); g.rect(4, -17, 3, 6);
    g.push(); g.translate(5, -16); g.rotate(-1.05);
    g.fill(sleeveC); g.rect(0, 0, 3, 7);
    if (tunic) { g.fill(oc); g.rect(0, 4, 3, 2); }
    g.fill(sk); g.rect(0, 6, 3, 3); g.pop();
    g.fill('#cf6b4b'); g.rect(1, -25 + sp, 5, 4);
    g.fill('#e88a6a'); g.rect(1, -25 + sp, 5, 1);
    g.fill('#cf6b4b'); g.rect(5, -24 + sp, 2, 2);
  } else {
    g.fill(sleeveC); g.rect(-7, -16, 3, 10); g.rect(4, -16, 3, 10);
    if (tunic) {
      g.fill(oc); g.rect(-7, -10, 3, 3); g.rect(4, -10, 3, 3);
      g.fill(ocH); g.rect(-7, -10, 3, 1); g.rect(4, -10, 3, 1);
    }
    g.fill(sk); g.rect(-7, -7, 3, 3); g.rect(4, -7, 3, 3);
  }
}

/**
 * The classic flat sprite: the whole figure composed into one grid, in the
 * original front or back view and pose. Used for cutouts, portraits and the HUD.
 * @param {object} look
 * @param {{back?:boolean, pose?:'idle'|'typing'|'blocked'|'sip'|'walk', t?:number, step?:number}} [opt]
 */
export function paintFlatCharacter(look, opt = {}) {
  const parts = paintCharacter(look, { ...opt, voxel: false });
  const g = new Pix({ x0: -16, y0: -62, x1: 16, y1: 2 });
  g.noStroke();
  const back = !!opt.back;
  const blit = (p, dy = 0) => {
    for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) {
      const cell = p.cells[j * p.w + i];
      if (!cell) continue;
      if (back && cell[0].z0 > 1) continue;            // purely frontal bits (snout, glasses)
      const c = back ? cell[0] : cell[cell.length - 1];
      const gi = p.x0 + i - g.x0, gj = p.y0 + j + dy - g.y0;
      if (gi < 0 || gj < 0 || gi >= g.w || gj >= g.h) continue;
      g.cells[gj * g.w + gi] = [{ z0: -1, z1: 1, r: c.r, g: c.g, b: c.b }];
    }
  };
  const step = opt.step || 0;                           // walking: legs alternate
  blit(parts.legL, step > 0 ? -1 : 0);
  blit(parts.legR, step < 0 ? -1 : 0);
  blit(parts.torso);
  paintArmsFlat(g, look, opt.pose || 'idle', opt.t || 0);
  blit(parts.head);
  return g;
}
