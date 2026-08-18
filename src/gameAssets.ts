function svgAsset(w: number, h: number, body: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`)}`;
}

function tileSheetAsset(p: { body: string; top: string; topLine: string; dirtLine: string }) {
  const style = `<style>
      .g { fill: ${p.top}; } .gb { fill: ${p.body}; }
      .s { fill: #787a7d; } .sb { fill: #484b4f; }
      .ib { fill: #8cc4e8; } .it { fill: #b8ebff; }
      .lb { fill: #b82d00; } .lt { fill: #ff8c3a; }
    </style>`;
  return svgAsset(256, 64, `<defs>${style}</defs>
<g transform="translate(0,0)"><rect width="64" height="64" class="gb"/><rect width="64" height="18" class="g" rx="3"/><path d="M 0 16 Q 8 26 16 16 T 32 16 T 48 16 T 64 16" fill="none" stroke="${p.topLine}" stroke-width="4" stroke-linecap="round"/><path d="M 8 32 L 20 32 M 14 42 L 24 42 M 40 50 L 52 50 M 44 26 L 56 26" stroke="${p.dirtLine}" stroke-width="3" stroke-linecap="round"/></g>
<g transform="translate(64,0)"><rect width="64" height="64" class="sb"/><rect width="64" height="18" class="s" rx="3"/><path d="M 0 18 L 64 18 M 20 18 L 20 34 M 44 18 L 44 34 M 0 34 L 64 34 M 32 34 L 32 50 M 0 50 L 64 50 M 16 50 L 16 64 M 48 50 L 48 64" stroke="#333" stroke-width="2" fill="none"/><path d="M 2 2 L 62 2" stroke="#999" stroke-width="2"/></g>
<g transform="translate(128,0)"><rect width="64" height="64" class="ib"/><rect width="64" height="16" class="it" rx="3"/><path d="M 8 28 L 20 40 M 16 46 L 24 54 M 40 24 L 54 38 M 36 50 L 46 60" stroke="#7cb2d6" stroke-width="3" stroke-linecap="round" fill="none"/><path d="M 0 16 L 8 26 L 16 16 L 24 24 L 32 16 L 40 24 L 48 16 L 56 26 L 64 16" stroke="#e0f6ff" stroke-width="3" fill="none" stroke-linejoin="round"/></g>
<g transform="translate(192,0)"><rect width="64" height="64" class="lb"/><rect width="64" height="16" class="lt" rx="3"/><path d="M 0 16 Q 8 24 16 16 T 32 16 T 48 16 T 64 16" stroke="#fff4a3" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M 0 16 L 64 16 M 16 16 L 16 32 M 48 16 L 48 32 M 0 32 L 64 32 M 32 32 L 32 48 M 0 48 L 64 48 M 16 48 L 16 64 M 48 48 L 48 64" stroke="#8c1b00" stroke-width="3" fill="none"/></g>`);
}

function springSheetAsset() {
  const frames = [38, 28, 16].map((py, i) => {
    const zig = [2, 4, 6][i];
    let coil = "";
    for (let k = 0; k < zig; k++) {
      const y1 = 45 - (k * 14) / (zig - 1);
      const y2 = 45 - ((k + 1) * 14) / (zig - 1);
      coil += `<path d="M ${k % 2 === 0 ? -16 : 16} ${y1.toFixed(1)} L ${k % 2 === 0 ? 16 : -16} ${y2.toFixed(1)}" stroke="#8d97a8" stroke-width="5" stroke-linecap="round" fill="none"/>`;
    }
    return `<g transform="translate(${i * 64},0)"><rect x="-22" y="52" width="44" height="8" rx="3" fill="#6d7685"/><rect x="-18" y="45" width="36" height="7" rx="3" fill="#8d97a8"/>${coil}<rect x="-18" y="${py}" width="36" height="8" rx="3" fill="#ffd76a"/><rect x="-18" y="${py + 8}" width="36" height="2" rx="1" fill="#ffe9a8"/></g>`;
  });
  return svgAsset(192, 64, frames.join(""));
}

function bossSheetAsset() {
  const spike = `<path d="M0 -56 L 6 -44 L 20 -48 L 14 -36 L 28 -34 L 18 -24 L 30 -16 L 18 -12 L 26 2 L 14 -2 L 16 12 L 4 4 L 0 16 L -4 4 L -16 12 L -14 -2 L -26 2 L -18 -12 L -30 -16 L -18 -24 L -28 -34 L -14 -36 L -20 -48 L -6 -44 Z" fill="#ff9d2e" stroke="#c96a1a" stroke-width="3" stroke-linejoin="round"/>`;
  const body = (angry: boolean, rot: number) => {
    const face = angry
      ? `<circle cx="-12" cy="0" r="4.5" fill="#fff"/><circle cx="12" cy="0" r="4.5" fill="#fff"/><circle cx="-12" cy="0" r="2.2" fill="#7a0c0c"/><circle cx="12" cy="0" r="2.2" fill="#7a0c0c"/><path d="M-17 -8 L -8 -2 M17 -8 L 8 -2" stroke="#7a0c0c" stroke-width="3" stroke-linecap="round"/><path d="M-10 12 Q 0 24 10 12 L 6 20 L -6 20 Z" fill="#8c1b1b"/>`
      : `<circle cx="-12" cy="2" r="4.5" fill="#111"/><circle cx="12" cy="2" r="4.5" fill="#111"/><path d="M-9 14 Q 0 21 9 14" stroke="#8a4a00" stroke-width="3.5" fill="none"/>`;
    return `<ellipse cx="0" cy="52" rx="48" ry="11" fill="#000" opacity="0.3"/><g transform="rotate(${rot} 0 4)">${spike}</g><circle cx="0" cy="4" r="34" fill="${angry ? "#ff6b3a" : "#ffb12b"}"/><rect x="-17" y="-34" width="34" height="10" rx="3" fill="#ffd76a"/><path d="M-17 -34 L -12 -46 L -4 -36 L 0 -50 L 4 -36 L 12 -46 L 17 -34 Z" fill="#ffd76a"/>${face}`;
  };
  let out = "";
  for (let i = 0; i < 4; i++) out += `<g transform="translate(${i * 128}, 64)">${body(false, [0, 10, -6, 18][i])}</g>`;
  for (let i = 0; i < 4; i++) out += `<g transform="translate(${i * 128}, 192)">${body(true, [0, 12, -8, 20][i])}</g>`;
  return svgAsset(512, 256, out);
}

function lightningSheetAsset() {
  const bolt = (p: string) => `<path d="${p}" fill="#fff8c4" stroke="#ffd76a" stroke-width="3" stroke-linejoin="round"/>`;
  return svgAsset(360, 260,
    `<g transform="translate(60,130)">${bolt("M0 -120 L -26 -60 L -8 -60 L -32 24 L -8 4 L -28 62 L 12 -8 L -4 -22 L 22 -78 L 2 -78 Z")}</g>` +
    `<g transform="translate(180,130)">${bolt("M0 -120 L -20 -70 L -4 -70 L -24 10 L -4 -6 L -18 56 L 14 -12 L -2 -26 L 18 -84 Z")}</g>` +
    `<g transform="translate(300,130)"><ellipse cx="0" cy="-30" rx="80" ry="100" fill="#fff" opacity="0.35"/><circle cx="0" cy="-30" r="46" fill="#fff8c4" opacity="0.6"/>${bolt("M0 -120 L -22 -64 L -6 -64 L -26 16 L -6 -2 L -20 58 L 12 -10 L -2 -24 L 20 -80 Z")}</g>`);
}

export const assetList: Record<string, string> = {
  "ethan": `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1152" height="96" viewBox="0 0 1152 96">
<defs>
  <style>
    .hoodie { fill: #1a1a1a; }
    .pants { fill: #555861; }
    .shoes { fill: #101010; }
    .skin { fill: #ffc4a3; }
    .hair { fill: #2a1f1b; }
    .emblem { fill: #ff2a2a; }
    .white { fill: #ffffff; }
    .eye { fill: #15100f; }
  </style>
</defs>
  <g transform="translate(0, 0)">
    <ellipse cx="48" cy="90" rx="18" ry="4" fill="#000" opacity="0.3"/>
    <path d="M40 60" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M42 64 Q42 76 40 88 M54 64 Q54 76 56 88" stroke="#555861" stroke-width="9" stroke-linecap="round" fill="none"/>
    <rect x="36" y="42" width="24" height="24" rx="8" class="hoodie" />
    <path d="M43 56 L48 62 L53 56 Z" class="emblem" />
    <circle cx="48" cy="30" r="14" class="skin" />
    <path d="M34 30 Q30 10 48 14 Q66 10 62 30 Q68 20 66 12 Q48 4 30 12 Q28 20 34 30" class="hair"/>
    <path d="M40 44 Q36 55 40 60 M56 44 Q60 55 56 60" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <g transform=""><circle cx="43" cy="28" r="2.5" class="eye"/><circle cx="53" cy="28" r="2.5" class="eye"/><circle cx="44" cy="27" r="1" class="white"/><circle cx="54" cy="27" r="1" class="white"/><path d="M46 33 Q48 36 50 33" stroke="#aa7c6f" stroke-width="1.5" stroke-linecap="round" fill="none"/></g>
    <path d="M38 20 Q43 25 46 18 Q50 24 56 18" stroke="#2a1f1b" stroke-width="3" stroke-linecap="round" fill="none"/>
  </g>
  <g transform="translate(0, 1)">
    <ellipse cx="144" cy="89" rx="18" ry="4" fill="#000" opacity="0.3"/>
    <path d="M136 60" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M138 64 Q138 76 136 88 M150 64 Q150 76 152 88" stroke="#555861" stroke-width="9" stroke-linecap="round" fill="none"/>
    <rect x="132" y="42" width="24" height="24" rx="8" class="hoodie" />
    <path d="M139 56 L144 62 L149 56 Z" class="emblem" />
    <circle cx="144" cy="30" r="14" class="skin" />
    <path d="M130 30 Q126 10 144 14 Q162 10 158 30 Q164 20 162 12 Q144 4 126 12 Q124 20 130 30" class="hair"/>
    <path d="M136 44 Q132 55 136 60 M152 44 Q156 55 152 60" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <g transform=""><circle cx="139" cy="28" r="2.5" class="eye"/><circle cx="149" cy="28" r="2.5" class="eye"/><circle cx="140" cy="27" r="1" class="white"/><circle cx="150" cy="27" r="1" class="white"/><path d="M142 33 Q144 36 146 33" stroke="#aa7c6f" stroke-width="1.5" stroke-linecap="round" fill="none"/></g>
    <path d="M134 20 Q139 25 142 18 Q146 24 152 18" stroke="#2a1f1b" stroke-width="3" stroke-linecap="round" fill="none"/>
  </g>
  <g transform="translate(0, -2)">
    <ellipse cx="240" cy="92" rx="18" ry="4" fill="#000" opacity="0.3"/>
    <path d="M232 62 M248 44 Q262 54 258 60" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M234 64 Q230 78 236 88 M246 64 Q250 78 254 80" stroke="#555861" stroke-width="9" stroke-linecap="round" fill="none"/>
    <rect x="228" y="42" width="24" height="24" rx="8" class="hoodie" />
    <path d="M235 56 L240 62 L245 56 Z" class="emblem" />
    <circle cx="240" cy="30" r="14" class="skin" />
    <path d="M226 30 Q222 10 240 14 Q258 10 254 30 Q260 20 258 12 Q240 4 222 12 Q220 20 226 30" class="hair"/>
    <path d="M232 44 Q226 54 230 62 M248 60" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <g transform=""><circle cx="235" cy="28" r="2.5" class="eye"/><circle cx="245" cy="28" r="2.5" class="eye"/><circle cx="236" cy="27" r="1" class="white"/><circle cx="246" cy="27" r="1" class="white"/><path d="M238 33 Q240 36 242 33" stroke="#aa7c6f" stroke-width="1.5" stroke-linecap="round" fill="none"/></g>
    <path d="M230 20 Q235 25 238 18 Q242 24 248 18" stroke="#2a1f1b" stroke-width="3" stroke-linecap="round" fill="none"/>
  </g>
  <g transform="translate(0, 0)">
    <ellipse cx="336" cy="90" rx="18" ry="4" fill="#000" opacity="0.3"/>
    <path d="M328 62 M344 44 Q330 54 334 60" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M330 64 Q334 78 332 88 M342 64 Q336 78 336 88" stroke="#555861" stroke-width="9" stroke-linecap="round" fill="none"/>
    <rect x="324" y="42" width="24" height="24" rx="8" class="hoodie" />
    <path d="M331 56 L336 62 L341 56 Z" class="emblem" />
    <circle cx="336" cy="30" r="14" class="skin" />
    <path d="M322 30 Q318 10 336 14 Q354 10 350 30 Q356 20 354 12 Q336 4 318 12 Q316 20 322 30" class="hair"/>
    <path d="M328 44 Q342 54 338 62 M344 60" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <g transform=""><circle cx="331" cy="28" r="2.5" class="eye"/><circle cx="341" cy="28" r="2.5" class="eye"/><circle cx="332" cy="27" r="1" class="white"/><circle cx="342" cy="27" r="1" class="white"/><path d="M334 33 Q336 36 338 33" stroke="#aa7c6f" stroke-width="1.5" stroke-linecap="round" fill="none"/></g>
    <path d="M326 20 Q331 25 334 18 Q338 24 344 18" stroke="#2a1f1b" stroke-width="3" stroke-linecap="round" fill="none"/>
  </g>
  <g transform="translate(0, -2)">
    <ellipse cx="432" cy="92" rx="18" ry="4" fill="#000" opacity="0.3"/>
    <path d="M424 62 M440 44 Q454 54 450 60" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M426 64 Q422 78 428 88 M438 64 Q442 78 446 80" stroke="#555861" stroke-width="9" stroke-linecap="round" fill="none"/>
    <rect x="420" y="42" width="24" height="24" rx="8" class="hoodie" />
    <path d="M427 56 L432 62 L437 56 Z" class="emblem" />
    <circle cx="432" cy="30" r="14" class="skin" />
    <path d="M418 30 Q414 10 432 14 Q450 10 446 30 Q452 20 450 12 Q432 4 414 12 Q412 20 418 30" class="hair"/>
    <path d="M424 44 Q418 54 422 62 M440 60" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <g transform=""><circle cx="427" cy="28" r="2.5" class="eye"/><circle cx="437" cy="28" r="2.5" class="eye"/><circle cx="428" cy="27" r="1" class="white"/><circle cx="438" cy="27" r="1" class="white"/><path d="M430 33 Q432 36 434 33" stroke="#aa7c6f" stroke-width="1.5" stroke-linecap="round" fill="none"/></g>
    <path d="M422 20 Q427 25 430 18 Q434 24 440 18" stroke="#2a1f1b" stroke-width="3" stroke-linecap="round" fill="none"/>
  </g>
  <g transform="translate(0, 0)">
    <ellipse cx="528" cy="90" rx="18" ry="4" fill="#000" opacity="0.3"/>
    <path d="M520 62 M536 44 Q522 54 526 60" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M522 64 Q526 78 524 88 M534 64 Q528 78 528 88" stroke="#555861" stroke-width="9" stroke-linecap="round" fill="none"/>
    <rect x="516" y="42" width="24" height="24" rx="8" class="hoodie" />
    <path d="M523 56 L528 62 L533 56 Z" class="emblem" />
    <circle cx="528" cy="30" r="14" class="skin" />
    <path d="M514 30 Q510 10 528 14 Q546 10 542 30 Q548 20 546 12 Q528 4 510 12 Q508 20 514 30" class="hair"/>
    <path d="M520 44 Q534 54 530 62 M536 60" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <g transform=""><circle cx="523" cy="28" r="2.5" class="eye"/><circle cx="533" cy="28" r="2.5" class="eye"/><circle cx="524" cy="27" r="1" class="white"/><circle cx="534" cy="27" r="1" class="white"/><path d="M526 33 Q528 36 530 33" stroke="#aa7c6f" stroke-width="1.5" stroke-linecap="round" fill="none"/></g>
    <path d="M518 20 Q523 25 526 18 Q530 24 536 18" stroke="#2a1f1b" stroke-width="3" stroke-linecap="round" fill="none"/>
  </g>
  <g transform="translate(0, -5)">
    <ellipse cx="624" cy="95" rx="18" ry="4" fill="#000" opacity="0.3"/>
    <path d="M616 28" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M618 64 Q610 70 612 80 M630 64 Q636 75 632 82" stroke="#555861" stroke-width="9" stroke-linecap="round" fill="none"/>
    <rect x="612" y="42" width="24" height="24" rx="8" class="hoodie" />
    <path d="M619 56 L624 62 L629 56 Z" class="emblem" />
    <circle cx="624" cy="30" r="14" class="skin" />
    <path d="M610 30 Q606 10 624 14 Q642 10 638 30 Q644 20 642 12 Q624 4 606 12 Q604 20 610 30" class="hair"/>
    <path d="M616 44 Q606 34 608 28 M632 44 Q642 34 640 28" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <g transform=""><circle cx="619" cy="28" r="2.5" class="eye"/><circle cx="629" cy="28" r="2.5" class="eye"/><circle cx="620" cy="27" r="1" class="white"/><circle cx="630" cy="27" r="1" class="white"/><path d="M622 33 Q624 36 626 33" stroke="#aa7c6f" stroke-width="1.5" stroke-linecap="round" fill="none"/></g>
    <path d="M614 20 Q619 25 622 18 Q626 24 632 18" stroke="#2a1f1b" stroke-width="3" stroke-linecap="round" fill="none"/>
  </g>
  <g transform="translate(0, 0)">
    <ellipse cx="720" cy="90" rx="18" ry="4" fill="#000" opacity="0.3"/>
    <path d="M712 28" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M714 64 Q712 76 714 88 M726 64 Q728 76 730 88" stroke="#555861" stroke-width="9" stroke-linecap="round" fill="none"/>
    <rect x="708" y="42" width="24" height="24" rx="8" class="hoodie" />
    <path d="M715 56 L720 62 L725 56 Z" class="emblem" />
    <circle cx="720" cy="30" r="14" class="skin" />
    <path d="M706 30 Q702 10 720 14 Q738 10 734 30 Q740 20 738 12 Q720 4 702 12 Q700 20 706 30" class="hair"/>
    <path d="M712 44 Q702 34 704 28 M728 44 Q738 34 736 28" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <g transform=""><circle cx="715" cy="28" r="2.5" class="eye"/><circle cx="725" cy="28" r="2.5" class="eye"/><circle cx="716" cy="27" r="1" class="white"/><circle cx="726" cy="27" r="1" class="white"/><path d="M718 33 Q720 36 722 33" stroke="#aa7c6f" stroke-width="1.5" stroke-linecap="round" fill="none"/></g>
    <path d="M710 20 Q715 25 718 18 Q722 24 728 18" stroke="#2a1f1b" stroke-width="3" stroke-linecap="round" fill="none"/>
  </g>
  <g transform="translate(0, 4)">
    <ellipse cx="816" cy="86" rx="18" ry="4" fill="#000" opacity="0.3"/>
    <path d="M808 60" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M810 64 Q810 76 808 88 M822 64 Q822 76 824 88" stroke="#555861" stroke-width="9" stroke-linecap="round" fill="none"/>
    <rect x="804" y="42" width="24" height="24" rx="8" class="hoodie" />
    <path d="M811 56 L816 62 L821 56 Z" class="emblem" />
    <circle cx="816" cy="30" r="14" class="skin" />
    <path d="M802 30 Q798 10 816 14 Q834 10 830 30 Q836 20 834 12 Q816 4 798 12 Q796 20 802 30" class="hair"/>
    <path d="M808 44 Q804 55 808 60 M824 44 Q828 55 824 60" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <g transform=""><path d="M808 28 l4 4 m0 -4 l-4 4 M820 28 l4 4 m0 -4 l-4 4" stroke="#000" stroke-width="1.5"/></g>
    <path d="M806 20 Q811 25 814 18 Q818 24 824 18" stroke="#2a1f1b" stroke-width="3" stroke-linecap="round" fill="none"/>
  </g>
  <g transform="translate(0, -8)">
    <ellipse cx="912" cy="98" rx="18" ry="4" fill="#000" opacity="0.3"/>
    <path d="M904 20" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M906 64 Q906 76 904 88 M918 64 Q918 76 920 88" stroke="#555861" stroke-width="9" stroke-linecap="round" fill="none"/>
    <rect x="900" y="42" width="24" height="24" rx="8" class="hoodie" />
    <path d="M907 56 L912 62 L917 56 Z" class="emblem" />
    <circle cx="912" cy="30" r="14" class="skin" />
    <path d="M898 30 Q894 10 912 14 Q930 10 926 30 Q932 20 930 12 Q912 4 894 12 Q892 20 898 30" class="hair"/>
    <path d="M904 44 Q892 30 898 20 M920 44 Q932 30 926 20" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <g transform="translate(0,-2)"><circle cx="907" cy="28" r="2.5" class="eye"/><circle cx="917" cy="28" r="2.5" class="eye"/><circle cx="908" cy="27" r="1" class="white"/><circle cx="918" cy="27" r="1" class="white"/><path d="M910 33 Q912 36 914 33" stroke="#aa7c6f" stroke-width="1.5" stroke-linecap="round" fill="none"/></g>
    <path d="M902 20 Q907 25 910 18 Q914 24 920 18" stroke="#2a1f1b" stroke-width="3" stroke-linecap="round" fill="none"/>
  </g>
  <g transform="translate(0, 0)">
    <ellipse cx="1008" cy="90" rx="20" ry="4" fill="#000" opacity="0.3"/>
    <path d="M1000 70 C998 84 996 88 1004 88 M1016 70 C1018 84 1020 88 1012 88" stroke="#555861" stroke-width="10" stroke-linecap="round" fill="none"/>
    <rect x="996" y="52" width="24" height="20" rx="8" class="hoodie" />
    <path d="M1003 62 L1008 68 L1013 62 Z" class="emblem" />
    <circle cx="1008" cy="40" r="14" class="skin" />
    <path d="M994 40 Q990 20 1008 24 Q1026 20 1022 40 Q1028 30 1026 22 Q1008 14 990 22 Q988 30 994 40" class="hair"/>
    <path d="M1000 54 Q992 65 1000 74 M1016 54 Q1024 65 1016 74" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <g transform=""><circle cx="1003" cy="38" r="2.5" class="eye"/><circle cx="1013" cy="38" r="2.5" class="eye"/><circle cx="1004" cy="37" r="1" class="white"/><circle cx="1014" cy="37" r="1" class="white"/><path d="M1006 43 Q1008 46 1010 43" stroke="#aa7c6f" stroke-width="1.5" stroke-linecap="round" fill="none"/></g>
    <path d="M998 30 Q1003 35 1006 28 Q1010 34 1016 28" stroke="#2a1f1b" stroke-width="3" stroke-linecap="round" fill="none"/>
  </g>
  <g transform="translate(0, 0)">
    <ellipse cx="1104" cy="90" rx="18" ry="4" fill="#000" opacity="0.3"/>
    <path d="M1098 64 Q1098 76 1096 88 M1110 64 Q1110 76 1112 88" stroke="#555861" stroke-width="9" stroke-linecap="round" fill="none"/>
    <rect x="1092" y="42" width="24" height="24" rx="8" class="hoodie" />
    <path d="M1099 56 L1104 62 L1109 56 Z" class="emblem" />
    <circle cx="1104" cy="30" r="14" class="skin" />
    <path d="M1090 30 Q1086 10 1104 14 Q1122 10 1118 30 Q1124 20 1122 12 Q1104 4 1086 12 Q1084 20 1090 30" class="hair"/>
    <path d="M1096 44 Q1092 55 1096 60 M1112 44 Q1125 42 1135 48" stroke="#1a1a1a" stroke-width="8" stroke-linecap="round" fill="none"/>
    <g transform=""><circle cx="1099" cy="28" r="2.5" class="eye"/><circle cx="1109" cy="28" r="2.5" class="eye"/><circle cx="1100" cy="27" r="1" class="white"/><circle cx="1110" cy="27" r="1" class="white"/><path d="M1102 33 Q1104 36 1106 33" stroke="#aa7c6f" stroke-width="1.5" stroke-linecap="round" fill="none"/></g>
    <path d="M1094 20 Q1099 25 1102 18 Q1106 24 1112 18" stroke="#2a1f1b" stroke-width="3" stroke-linecap="round" fill="none"/>
  </g>
</svg>
`)}`,
  "enemies": `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="640" viewBox="0 0 320 640">
  <defs>
    <style>
      .slime { fill: #48d16f; }
      .mushroom-top { fill: #ff4747; }
      .mushroom-base { fill: #fcedd9; }
      .bug-body { fill: #8a3eb5; }
      .bug-wing { fill: #c0f4ff; opacity: 0.7; }
      .roller { fill: #ffb12b; }
      .eye { fill: #111; }
      .shadow { fill: #000; opacity: 0.2; }
    </style>
  </defs>

  <g transform="translate(0, 0)">
    <ellipse cx="40" cy="74" rx="28" ry="6" class="shadow"/>
    <path d="M12 70 Q 12 40 40 40 Q 68 40 68 70 Z" class="slime" />
    <circle cx="30" cy="58" r="3" class="eye"/>
    <circle cx="50" cy="58" r="3" class="eye"/>
  </g>
  <g transform="translate(80, 0)">
    <ellipse cx="40" cy="74" rx="26" ry="5" class="shadow"/>
    <path d="M14 70 Q 14 36 40 36 Q 66 36 66 70 Z" class="slime" />
    <circle cx="30" cy="56" r="3" class="eye"/>
    <circle cx="50" cy="56" r="3" class="eye"/>
  </g>
  <g transform="translate(160, 0)">
    <ellipse cx="40" cy="74" rx="28" ry="6" class="shadow"/>
    <path d="M12 70 Q 12 40 40 40 Q 68 40 68 70 Z" class="slime" />
    <circle cx="30" cy="58" r="3" class="eye"/>
    <circle cx="50" cy="58" r="3" class="eye"/>
  </g>
  <g transform="translate(240, 0)">
    <ellipse cx="40" cy="74" rx="30" ry="7" class="shadow"/>
    <path d="M10 70 Q 10 44 40 44 Q 70 44 70 70 Z" class="slime" />
    <circle cx="30" cy="60" r="3" class="eye"/>
    <circle cx="50" cy="60" r="3" class="eye"/>
  </g>

  <g transform="translate(0, 80)">
    <ellipse cx="40" cy="74" rx="22" ry="6" class="shadow"/>
    <rect x="28" y="44" width="24" height="30" rx="8" class="mushroom-base" />
    <path d="M12 45 Q 40 10 68 45 Z" class="mushroom-top" />
    <circle cx="40" cy="28" r="6" fill="#fff"/>
    <circle cx="24" cy="38" r="4" fill="#fff"/>
    <circle cx="56" cy="38" r="4" fill="#fff"/>
    <circle cx="34" cy="54" r="2.5" class="eye"/>
    <circle cx="46" cy="54" r="2.5" class="eye"/>
  </g>
  <g transform="translate(80, 80)">
    <ellipse cx="40" cy="74" rx="22" ry="6" class="shadow"/>
    <rect x="28" y="44" width="24" height="30" rx="8" class="mushroom-base" />
    <path d="M12 47 Q 40 12 68 47 Z" class="mushroom-top" />
    <circle cx="40" cy="30" r="6" fill="#fff"/>
    <circle cx="24" cy="40" r="4" fill="#fff"/>
    <circle cx="56" cy="40" r="4" fill="#fff"/>
    <circle cx="34" cy="56" r="2.5" class="eye"/>
    <circle cx="46" cy="56" r="2.5" class="eye"/>
  </g>
  <g transform="translate(160, 80)">
    <ellipse cx="40" cy="74" rx="22" ry="6" class="shadow"/>
    <rect x="28" y="44" width="24" height="30" rx="8" class="mushroom-base" />
    <path d="M12 45 Q 40 10 68 45 Z" class="mushroom-top" />
    <circle cx="40" cy="28" r="6" fill="#fff"/>
    <circle cx="24" cy="38" r="4" fill="#fff"/>
    <circle cx="56" cy="38" r="4" fill="#fff"/>
    <circle cx="34" cy="54" r="2.5" class="eye"/>
    <circle cx="46" cy="54" r="2.5" class="eye"/>
  </g>
  <g transform="translate(240, 80)">
    <ellipse cx="40" cy="74" rx="22" ry="6" class="shadow"/>
    <rect x="28" y="42" width="24" height="32" rx="8" class="mushroom-base" />
    <path d="M12 43 Q 40 8 68 43 Z" class="mushroom-top" />
    <circle cx="40" cy="26" r="6" fill="#fff"/>
    <circle cx="24" cy="36" r="4" fill="#fff"/>
    <circle cx="56" cy="36" r="4" fill="#fff"/>
    <circle cx="34" cy="52" r="2.5" class="eye"/>
    <circle cx="46" cy="52" r="2.5" class="eye"/>
  </g>

  <g transform="translate(0, 160)">
    <ellipse cx="40" cy="70" rx="20" ry="6" class="shadow" opacity="0.1"/>
    <ellipse cx="28" cy="34" rx="12" ry="24" class="bug-wing" transform="rotate(-30 28 34)"/>
    <ellipse cx="52" cy="34" rx="12" ry="24" class="bug-wing" transform="rotate(30 52 34)"/>
    <ellipse cx="40" cy="46" rx="22" ry="18" class="bug-body"/>
    <circle cx="32" cy="44" r="3.5" class="eye"/>
    <circle cx="48" cy="44" r="3.5" class="eye"/>
  </g>
  <g transform="translate(80, 160)">
    <ellipse cx="40" cy="70" rx="20" ry="6" class="shadow" opacity="0.1"/>
    <ellipse cx="24" cy="38" rx="14" ry="20" class="bug-wing" transform="rotate(-60 24 38)"/>
    <ellipse cx="56" cy="38" rx="14" ry="20" class="bug-wing" transform="rotate(60 56 38)"/>
    <ellipse cx="40" cy="48" rx="22" ry="18" class="bug-body"/>
    <circle cx="32" cy="46" r="3.5" class="eye"/>
    <circle cx="48" cy="46" r="3.5" class="eye"/>
  </g>
  <g transform="translate(160, 160)">
    <ellipse cx="40" cy="70" rx="20" ry="6" class="shadow" opacity="0.1"/>
    <ellipse cx="28" cy="34" rx="12" ry="24" class="bug-wing" transform="rotate(-30 28 34)"/>
    <ellipse cx="52" cy="34" rx="12" ry="24" class="bug-wing" transform="rotate(30 52 34)"/>
    <ellipse cx="40" cy="46" rx="22" ry="18" class="bug-body"/>
    <circle cx="32" cy="44" r="3.5" class="eye"/>
    <circle cx="48" cy="44" r="3.5" class="eye"/>
  </g>
  <g transform="translate(240, 160)">
    <ellipse cx="40" cy="70" rx="20" ry="6" class="shadow" opacity="0.1"/>
    <ellipse cx="32" cy="28" rx="10" ry="26" class="bug-wing" transform="rotate(-15 32 28)"/>
    <ellipse cx="48" cy="28" rx="10" ry="26" class="bug-wing" transform="rotate(15 48 28)"/>
    <ellipse cx="40" cy="44" rx="22" ry="18" class="bug-body"/>
    <circle cx="32" cy="42" r="3.5" class="eye"/>
    <circle cx="48" cy="42" r="3.5" class="eye"/>
  </g>

  <g transform="translate(0, 240)">
    <ellipse cx="40" cy="74" rx="26" ry="6" class="shadow" />
    <circle cx="40" cy="50" r="24" class="roller" />
    <path d="M40 26 A 24 24 0 0 1 64 50" stroke="#fff" stroke-width="4" fill="none" opacity="0.3"/>
    <circle cx="32" cy="46" r="3" class="eye"/>
    <circle cx="48" cy="46" r="3" class="eye"/>
  </g>
  <g transform="translate(80, 240)">
    <ellipse cx="40" cy="74" rx="26" ry="6" class="shadow" />
    <circle cx="40" cy="50" r="24" class="roller" />
    <path d="M64 50 A 24 24 0 0 1 40 74" stroke="#fff" stroke-width="4" fill="none" opacity="0.3"/>
    <circle cx="34" cy="48" r="3" class="eye"/>
    <circle cx="50" cy="48" r="3" class="eye"/>
  </g>
  <g transform="translate(160, 240)">
    <ellipse cx="40" cy="74" rx="26" ry="6" class="shadow" />
    <circle cx="40" cy="50" r="24" class="roller" />
    <path d="M40 74 A 24 24 0 0 1 16 50" stroke="#fff" stroke-width="4" fill="none" opacity="0.3"/>
    <circle cx="32" cy="46" r="3" class="eye"/>
    <circle cx="48" cy="46" r="3" class="eye"/>
  </g>
  <g transform="translate(240, 240)">
    <ellipse cx="40" cy="74" rx="26" ry="6" class="shadow" />
    <circle cx="40" cy="50" r="24" class="roller" />
    <path d="M16 50 A 24 24 0 0 1 40 26" stroke="#fff" stroke-width="4" fill="none" opacity="0.3"/>
    <circle cx="30" cy="48" r="3" class="eye"/>
    <circle cx="46" cy="48" r="3" class="eye"/>
  </g>

  <g transform="translate(0, 320)">
    <ellipse cx="40" cy="76" rx="30" ry="7" class="shadow"/>
    <g transform="rotate(0 40 50)">
      <path d="M40 22 L 47 31 L 57 28 L 55 38 L 65 42 L 59 50 L 69 56 L 61 63 L 68 71 L 58 74 L 61 83 L 51 80 L 47 88 L 40 81 L 33 88 L 29 80 L 19 83 L 22 74 L 12 71 L 19 63 L 11 56 L 21 50 L 15 42 L 25 38 L 23 28 L 33 31 Z" fill="#9aa0c0" stroke="#5d6079" stroke-width="3" stroke-linejoin="round"/>
    </g>
    <circle cx="31" cy="52" r="3.5" class="eye"/>
    <circle cx="49" cy="52" r="3.5" class="eye"/>
    <path d="M34 60 Q40 66 46 60" stroke="#3f4154" stroke-width="2.5" fill="none"/>
  </g>
  <g transform="translate(80, 320)">
    <ellipse cx="40" cy="76" rx="30" ry="7" class="shadow"/>
    <g transform="rotate(15 40 50)">
      <path d="M40 22 L 47 31 L 57 28 L 55 38 L 65 42 L 59 50 L 69 56 L 61 63 L 68 71 L 58 74 L 61 83 L 51 80 L 47 88 L 40 81 L 33 88 L 29 80 L 19 83 L 22 74 L 12 71 L 19 63 L 11 56 L 21 50 L 15 42 L 25 38 L 23 28 L 33 31 Z" fill="#9aa0c0" stroke="#5d6079" stroke-width="3" stroke-linejoin="round"/>
    </g>
    <circle cx="31" cy="52" r="3.5" class="eye"/>
    <circle cx="49" cy="52" r="3.5" class="eye"/>
    <path d="M34 60 Q40 66 46 60" stroke="#3f4154" stroke-width="2.5" fill="none"/>
  </g>
  <g transform="translate(160, 320)">
    <ellipse cx="40" cy="76" rx="30" ry="7" class="shadow"/>
    <g transform="rotate(-8 40 50)">
      <path d="M40 22 L 47 31 L 57 28 L 55 38 L 65 42 L 59 50 L 69 56 L 61 63 L 68 71 L 58 74 L 61 83 L 51 80 L 47 88 L 40 81 L 33 88 L 29 80 L 19 83 L 22 74 L 12 71 L 19 63 L 11 56 L 21 50 L 15 42 L 25 38 L 23 28 L 33 31 Z" fill="#9aa0c0" stroke="#5d6079" stroke-width="3" stroke-linejoin="round"/>
    </g>
    <circle cx="31" cy="52" r="3.5" class="eye"/>
    <circle cx="49" cy="52" r="3.5" class="eye"/>
    <path d="M34 60 Q40 66 46 60" stroke="#3f4154" stroke-width="2.5" fill="none"/>
  </g>
  <g transform="translate(240, 320)">
    <ellipse cx="40" cy="76" rx="30" ry="7" class="shadow"/>
    <g transform="rotate(22 40 50)">
      <path d="M40 22 L 47 31 L 57 28 L 55 38 L 65 42 L 59 50 L 69 56 L 61 63 L 68 71 L 58 74 L 61 83 L 51 80 L 47 88 L 40 81 L 33 88 L 29 80 L 19 83 L 22 74 L 12 71 L 19 63 L 11 56 L 21 50 L 15 42 L 25 38 L 23 28 L 33 31 Z" fill="#9aa0c0" stroke="#5d6079" stroke-width="3" stroke-linejoin="round"/>
    </g>
    <circle cx="31" cy="52" r="3.5" class="eye"/>
    <circle cx="49" cy="52" r="3.5" class="eye"/>
    <path d="M34 60 Q40 66 46 60" stroke="#3f4154" stroke-width="2.5" fill="none"/>
  </g>

  <g transform="translate(0, 400)">
    <ellipse cx="40" cy="78" rx="22" ry="5" class="shadow"/>
    <path d="M40 30 Q 14 36 16 58 Q 18 76 40 76 Q 62 76 64 58 Q 66 36 40 30 Z" fill="#ff9f43"/>
    <path d="M26 70 Q 22 88 14 82 M54 70 Q 58 88 66 82" stroke="#c96a1a" stroke-width="6" stroke-linecap="round" fill="none"/>
    <circle cx="31" cy="52" r="3.5" class="eye"/>
    <circle cx="49" cy="52" r="3.5" class="eye"/>
    <path d="M34 62 Q40 68 46 62" stroke="#a0520f" stroke-width="2.5" fill="none"/>
  </g>
  <g transform="translate(80, 400)">
    <ellipse cx="40" cy="78" rx="22" ry="5" class="shadow"/>
    <path d="M40 36 Q 14 42 16 62 Q 18 78 40 78 Q 62 78 64 62 Q 66 42 40 36 Z" fill="#ff9f43"/>
    <path d="M26 72 Q 22 90 14 84 M54 72 Q 58 90 66 84" stroke="#c96a1a" stroke-width="6" stroke-linecap="round" fill="none"/>
    <circle cx="31" cy="56" r="3.5" class="eye"/>
    <circle cx="49" cy="56" r="3.5" class="eye"/>
    <path d="M34 66 Q40 72 46 66" stroke="#a0520f" stroke-width="2.5" fill="none"/>
  </g>
  <g transform="translate(160, 400)">
    <ellipse cx="40" cy="78" rx="22" ry="5" class="shadow"/>
    <path d="M40 42 Q 12 48 14 64 Q 16 78 40 78 Q 64 78 66 64 Q 68 48 40 42 Z" fill="#ff9f43"/>
    <path d="M26 72 Q 22 90 14 84 M54 72 Q 58 90 66 84" stroke="#c96a1a" stroke-width="6" stroke-linecap="round" fill="none"/>
    <circle cx="31" cy="58" r="3.5" class="eye"/>
    <circle cx="49" cy="58" r="3.5" class="eye"/>
    <path d="M34 68 Q40 74 46 68" stroke="#a0520f" stroke-width="2.5" fill="none"/>
  </g>
  <g transform="translate(240, 400)">
    <ellipse cx="40" cy="78" rx="22" ry="5" class="shadow"/>
    <path d="M40 26 Q 16 32 18 56 Q 20 76 40 76 Q 60 76 62 56 Q 64 32 40 26 Z" fill="#ff9f43"/>
    <path d="M26 70 Q 22 88 14 82 M54 70 Q 58 88 66 82" stroke="#c96a1a" stroke-width="6" stroke-linecap="round" fill="none"/>
    <circle cx="31" cy="48" r="3.5" class="eye"/>
    <circle cx="49" cy="48" r="3.5" class="eye"/>
    <path d="M34 58 Q40 64 46 58" stroke="#a0520f" stroke-width="2.5" fill="none"/>
  </g>

  <g transform="translate(0, 480)">
    <ellipse cx="40" cy="72" rx="20" ry="5" class="shadow" opacity="0.15"/>
    <path d="M40 28 L 26 14 L 30 30 Z" fill="#bfe9ff" opacity="0.75"/>
    <ellipse cx="40" cy="44" rx="24" ry="20" fill="#d64545"/>
    <path d="M40 56 L 24 72 L 40 64 Z" fill="#ffd76a"/>
    <circle cx="32" cy="42" r="3.5" class="eye"/>
    <circle cx="48" cy="42" r="3.5" class="eye"/>
    <path d="M28 34 L 36 38 M52 34 L 44 38" stroke="#8c1b1b" stroke-width="2.5" fill="none"/>
  </g>
  <g transform="translate(80, 480)">
    <ellipse cx="40" cy="72" rx="20" ry="5" class="shadow" opacity="0.15"/>
    <path d="M40 24 L 22 12 L 28 28 Z" fill="#bfe9ff" opacity="0.75"/>
    <ellipse cx="40" cy="44" rx="24" ry="20" fill="#d64545"/>
    <path d="M40 58 L 26 74 L 40 66 Z" fill="#ffd76a"/>
    <circle cx="32" cy="42" r="3.5" class="eye"/>
    <circle cx="48" cy="42" r="3.5" class="eye"/>
    <path d="M28 34 L 36 38 M52 34 L 44 38" stroke="#8c1b1b" stroke-width="2.5" fill="none"/>
  </g>
  <g transform="translate(160, 480)">
    <ellipse cx="40" cy="72" rx="20" ry="5" class="shadow" opacity="0.15"/>
    <path d="M40 30 L 28 18 L 32 32 Z" fill="#bfe9ff" opacity="0.75"/>
    <ellipse cx="40" cy="44" rx="24" ry="20" fill="#d64545"/>
    <path d="M40 54 L 22 68 L 40 62 Z" fill="#ffd76a"/>
    <circle cx="32" cy="42" r="3.5" class="eye"/>
    <circle cx="48" cy="42" r="3.5" class="eye"/>
    <path d="M28 34 L 36 38 M52 34 L 44 38" stroke="#8c1b1b" stroke-width="2.5" fill="none"/>
  </g>
  <g transform="translate(240, 480)">
    <ellipse cx="40" cy="72" rx="20" ry="5" class="shadow" opacity="0.15"/>
    <path d="M40 22 L 20 10 L 26 26 Z" fill="#bfe9ff" opacity="0.75"/>
    <ellipse cx="40" cy="44" rx="24" ry="20" fill="#d64545"/>
    <path d="M40 60 L 28 76 L 40 68 Z" fill="#ffd76a"/>
    <circle cx="32" cy="42" r="3.5" class="eye"/>
    <circle cx="48" cy="42" r="3.5" class="eye"/>
    <path d="M28 34 L 36 38 M52 34 L 44 38" stroke="#8c1b1b" stroke-width="2.5" fill="none"/>
  </g>

  <g transform="translate(0, 560)">
    <ellipse cx="40" cy="74" rx="28" ry="6" class="shadow"/>
    <path d="M12 70 Q 12 40 40 40 Q 68 40 68 70 Z" fill="#3fbf63"/>
    <path d="M27 50 L 37 42 L 35 55 L 46 48 L 42 61 L 53 55" stroke="#1e7a3a" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
    <path d="M30 63 Q 40 68 50 63" stroke="#1e7a3a" stroke-width="2.5" fill="none"/>
    <path d="M40 42 L 40 35 M34 44 L 29 38 M46 44 L 51 38" stroke="#1e7a3a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <circle cx="30" cy="54" r="3" class="eye"/>
    <circle cx="50" cy="54" r="3" class="eye"/>
  </g>
  <g transform="translate(80, 560)">
    <ellipse cx="40" cy="74" rx="28" ry="6" class="shadow"/>
    <path d="M12 70 Q 12 40 40 40 Q 68 40 68 70 Z" fill="#3fbf63"/>
    <path d="M27 50 L 37 42 L 35 55 L 46 48 L 42 61 L 53 55" stroke="#1e7a3a" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
    <path d="M30 63 Q 40 68 50 63" stroke="#1e7a3a" stroke-width="2.5" fill="none"/>
    <path d="M40 42 L 40 35 M34 44 L 29 38 M46 44 L 51 38" stroke="#1e7a3a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <circle cx="30" cy="54" r="3" class="eye"/>
    <circle cx="50" cy="54" r="3" class="eye"/>
  </g>
  <g transform="translate(160, 560)">
    <ellipse cx="40" cy="74" rx="28" ry="6" class="shadow"/>
    <path d="M12 70 Q 12 40 40 40 Q 68 40 68 70 Z" fill="#3fbf63"/>
    <path d="M27 50 L 37 42 L 35 55 L 46 48 L 42 61 L 53 55" stroke="#1e7a3a" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
    <path d="M30 63 Q 40 68 50 63" stroke="#1e7a3a" stroke-width="2.5" fill="none"/>
    <path d="M40 42 L 40 35 M34 44 L 29 38 M46 44 L 51 38" stroke="#1e7a3a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <circle cx="30" cy="54" r="3" class="eye"/>
    <circle cx="50" cy="54" r="3" class="eye"/>
  </g>
  <g transform="translate(240, 560)">
    <ellipse cx="40" cy="74" rx="28" ry="6" class="shadow"/>
    <path d="M12 70 Q 12 40 40 40 Q 68 40 68 70 Z" fill="#3fbf63"/>
    <path d="M27 50 L 37 42 L 35 55 L 46 48 L 42 61 L 53 55" stroke="#1e7a3a" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
    <path d="M30 63 Q 40 68 50 63" stroke="#1e7a3a" stroke-width="2.5" fill="none"/>
    <path d="M40 42 L 40 35 M34 44 L 29 38 M46 44 L 51 38" stroke="#1e7a3a" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <circle cx="30" cy="54" r="3" class="eye"/>
    <circle cx="50" cy="54" r="3" class="eye"/>
  </g>
</svg>`)}`,
  "collectibles": `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="288" height="48" viewBox="0 0 288 48">
  <defs>
    <style>
      .star-base { fill: #ffdf30; stroke: #cc8e00; stroke-width: 2; stroke-linejoin: round; }
      .star-highlight { fill: #fff18c; opacity: 0.9; }
      .glow { fill: #ffd800; opacity: 0.4; }
    </style>
  </defs>
  
    <g transform="translate(24, 24) scale(0.625, 1)">
      <circle cx="0" cy="0" r="20" class="glow" />
      <polygon points="0,-16 4.7,-4.9 16.5,-3.8 7.5,3.8 10.3,15.3 0,9 -10.3,15.3 -7.5,3.8 -16.5,-3.8 -4.7,-4.9" class="star-base"/>
      <polygon points="0,-10 2,-4 8,-3 3,2 4,8 0,5 -4,8 -3,2 -8,-3 -2,-4" class="star-highlight"/>
    </g>
    
    <g transform="translate(72, 24) scale(0.775, 1)">
      <circle cx="0" cy="0" r="20" class="glow" />
      <polygon points="0,-16 4.7,-4.9 16.5,-3.8 7.5,3.8 10.3,15.3 0,9 -10.3,15.3 -7.5,3.8 -16.5,-3.8 -4.7,-4.9" class="star-base"/>
      <polygon points="0,-10 2,-4 8,-3 3,2 4,8 0,5 -4,8 -3,2 -8,-3 -2,-4" class="star-highlight"/>
    </g>
    
    <g transform="translate(120, 24) scale(0.925, 1)">
      <circle cx="0" cy="0" r="20" class="glow" />
      <polygon points="0,-16 4.7,-4.9 16.5,-3.8 7.5,3.8 10.3,15.3 0,9 -10.3,15.3 -7.5,3.8 -16.5,-3.8 -4.7,-4.9" class="star-base"/>
      <polygon points="0,-10 2,-4 8,-3 3,2 4,8 0,5 -4,8 -3,2 -8,-3 -2,-4" class="star-highlight"/>
    </g>
    
    <g transform="translate(168, 24) scale(0.925, 1)">
      <circle cx="0" cy="0" r="20" class="glow" />
      <polygon points="0,-16 4.7,-4.9 16.5,-3.8 7.5,3.8 10.3,15.3 0,9 -10.3,15.3 -7.5,3.8 -16.5,-3.8 -4.7,-4.9" class="star-base"/>
      <polygon points="0,-10 2,-4 8,-3 3,2 4,8 0,5 -4,8 -3,2 -8,-3 -2,-4" class="star-highlight"/>
    </g>
    
    <g transform="translate(216, 24) scale(0.775, 1)">
      <circle cx="0" cy="0" r="20" class="glow" />
      <polygon points="0,-16 4.7,-4.9 16.5,-3.8 7.5,3.8 10.3,15.3 0,9 -10.3,15.3 -7.5,3.8 -16.5,-3.8 -4.7,-4.9" class="star-base"/>
      <polygon points="0,-10 2,-4 8,-3 3,2 4,8 0,5 -4,8 -3,2 -8,-3 -2,-4" class="star-highlight"/>
    </g>
    
    <g transform="translate(264, 24) scale(0.625, 1)">
      <circle cx="0" cy="0" r="20" class="glow" />
      <polygon points="0,-16 4.7,-4.9 16.5,-3.8 7.5,3.8 10.3,15.3 0,9 -10.3,15.3 -7.5,3.8 -16.5,-3.8 -4.7,-4.9" class="star-base"/>
      <polygon points="0,-10 2,-4 8,-3 3,2 4,8 0,5 -4,8 -3,2 -8,-3 -2,-4" class="star-highlight"/>
    </g>
    
</svg>`)}`,
  "tiles": `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="64" viewBox="0 0 256 64">
  <defs>
    <style>
      .t-grass { fill: #5cc259; }
      .t-dirt { fill: #875c40; }
      .t-rock { fill: #787a7d; }
      .t-dark { fill: #484b4f; }
      .t-ice-top { fill: #b8ebff; }
      .t-ice { fill: #8cc4e8; }
      .t-lava-top { fill: #ff8c3a; }
      .t-lava { fill: #b82d00; }
    </style>
  </defs>

  <g transform="translate(0,0)">
    <rect width="64" height="64" class="t-dirt"/>
    <rect width="64" height="18" class="t-grass" rx="3"/>
    <path d="M 0 16 Q 8 26 16 16 T 32 16 T 48 16 T 64 16" fill="none" stroke="#4dad4a" stroke-width="4" stroke-linecap="round"/>
    <path d="M 8 32 L 20 32 M 14 42 L 24 42 M 40 50 L 52 50 M 44 26 L 56 26" stroke="#704b33" stroke-width="3" stroke-linecap="round"/>
  </g>

  <g transform="translate(64,0)">
    <rect width="64" height="64" class="t-dark"/>
    <rect width="64" height="18" class="t-rock" rx="3"/>
    <path d="M 0 18 L 64 18 M 20 18 L 20 34 M 44 18 L 44 34 M 0 34 L 64 34 M 32 34 L 32 50 M 0 50 L 64 50 M 16 50 L 16 64 M 48 50 L 48 64" stroke="#333" stroke-width="2"/>
    <path d="M 2 2 L 62 2" stroke="#999" stroke-width="2"/>
  </g>

  <g transform="translate(128,0)">
    <rect width="64" height="64" class="t-ice"/>
    <rect width="64" height="16" class="t-ice-top" rx="3"/>
    <path d="M 8 28 L 20 40 M 16 46 L 24 54 M 40 24 L 54 38 M 36 50 L 46 60" stroke="#7cb2d6" stroke-width="3" stroke-linecap="round" stroke-linejoin="miter"/>
    <path d="M 0 16 L 8 26 L 16 16 L 24 24 L 32 16 L 40 24 L 48 16 L 56 26 L 64 16" fill="none" stroke="#e0f6ff" stroke-width="3" stroke-linejoin="round"/>
  </g>

  <g transform="translate(192,0)">
    <rect width="64" height="64" class="t-lava"/>
    <rect width="64" height="16" class="t-lava-top" rx="3"/>
    <path d="M 0 16 Q 8 24 16 16 T 32 16 T 48 16 T 64 16" fill="none" stroke="#fff4a3" stroke-width="3" stroke-linecap="round"/>
    <path d="M 0 16 L 64 16 M 16 16 L 16 32 M 48 16 L 48 32 M 0 32 L 64 32 M 32 32 L 32 48 M 0 48 L 64 48 M 16 48 L 16 64 M 48 48 L 48 64" stroke="#8c1b00" stroke-width="3"/>
  </g>
</svg>`)}`,
  "portal": `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="576" height="128" viewBox="0 0 576 128">
  <defs>
    <style>
      .p-base { fill: #000; opacity: 0.3; }
      .p-glow { fill: #d35fff; opacity: 0.5; }
      .p-ring1 { fill: none; stroke: #ff91ff; stroke-width: 6; opacity: 0.9; }
      .p-ring2 { fill: none; stroke: #ffffff; stroke-width: 3; opacity: 0.8; }
    </style>
  </defs>
  
    <g transform="translate(48, 64)">
      <ellipse cx="0" cy="50" rx="36" ry="10" class="p-base"/>
      <ellipse cx="0" cy="0" rx="32" ry="54" class="p-glow" transform="scale(1, 1)"/>
      <ellipse cx="0" cy="0" rx="26" ry="46" class="p-ring1" transform="scale(1, 1) rotate(0)"/>
      <ellipse cx="0" cy="0" rx="20" ry="40" class="p-ring2" transform="scale(1, 1) rotate(0)"/>
    </g>
    
    <g transform="translate(144, 64)">
      <ellipse cx="0" cy="50" rx="36" ry="10" class="p-base"/>
      <ellipse cx="0" cy="0" rx="32" ry="54" class="p-glow" transform="scale(1.0866025403784439, 1.05)"/>
      <ellipse cx="0" cy="0" rx="26" ry="46" class="p-ring1" transform="scale(1.0866025403784439, 1.05) rotate(15)"/>
      <ellipse cx="0" cy="0" rx="20" ry="40" class="p-ring2" transform="scale(1.05, 1.0866025403784439) rotate(-20)"/>
    </g>
    
    <g transform="translate(240, 64)">
      <ellipse cx="0" cy="50" rx="36" ry="10" class="p-base"/>
      <ellipse cx="0" cy="0" rx="32" ry="54" class="p-glow" transform="scale(1.0866025403784439, 0.9500000000000001)"/>
      <ellipse cx="0" cy="0" rx="26" ry="46" class="p-ring1" transform="scale(1.0866025403784439, 0.9500000000000001) rotate(30)"/>
      <ellipse cx="0" cy="0" rx="20" ry="40" class="p-ring2" transform="scale(0.9500000000000001, 1.0866025403784439) rotate(-40)"/>
    </g>
    
    <g transform="translate(336, 64)">
      <ellipse cx="0" cy="50" rx="36" ry="10" class="p-base"/>
      <ellipse cx="0" cy="0" rx="32" ry="54" class="p-glow" transform="scale(1.0000000000000002, 0.9)"/>
      <ellipse cx="0" cy="0" rx="26" ry="46" class="p-ring1" transform="scale(1.0000000000000002, 0.9) rotate(45)"/>
      <ellipse cx="0" cy="0" rx="20" ry="40" class="p-ring2" transform="scale(0.9, 1.0000000000000002) rotate(-60)"/>
    </g>
    
    <g transform="translate(432, 64)">
      <ellipse cx="0" cy="50" rx="36" ry="10" class="p-base"/>
      <ellipse cx="0" cy="0" rx="32" ry="54" class="p-glow" transform="scale(0.9133974596215562, 0.9500000000000001)"/>
      <ellipse cx="0" cy="0" rx="26" ry="46" class="p-ring1" transform="scale(0.9133974596215562, 0.9500000000000001) rotate(60)"/>
      <ellipse cx="0" cy="0" rx="20" ry="40" class="p-ring2" transform="scale(0.9500000000000001, 0.9133974596215562) rotate(-80)"/>
    </g>
    
    <g transform="translate(528, 64)">
      <ellipse cx="0" cy="50" rx="36" ry="10" class="p-base"/>
      <ellipse cx="0" cy="0" rx="32" ry="54" class="p-glow" transform="scale(0.9133974596215562, 1.05)"/>
      <ellipse cx="0" cy="0" rx="26" ry="46" class="p-ring1" transform="scale(0.9133974596215562, 1.05) rotate(75)"/>
      <ellipse cx="0" cy="0" rx="20" ry="40" class="p-ring2" transform="scale(1.05, 0.9133974596215562) rotate(-100)"/>
    </g>
    
</svg>`)}`,
  "fireball": `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="64" viewBox="0 0 256 64">
  <defs>
    <style>
      .fb-core { fill: #fff; }
      .fb-inner { fill: #fced4e; }
      .fb-mid { fill: #ff8c00; }
      .fb-outer { fill: #e62000; opacity: 0.8; }
    </style>
  </defs>
  <g transform="translate(32, 32)">
    <path d="M-10,0 Q-25,-10 -30,0 Q-25,10 -10,0" class="fb-outer"/>
    <circle cx="0" cy="0" r="14" class="fb-outer" />
    <circle cx="0" cy="0" r="10" class="fb-mid" />
    <circle cx="1" cy="0" r="6" class="fb-inner" />
    <circle cx="2" cy="0" r="3" class="fb-core" />
    <path d="M-8,-8 Q-15,-15 -20,-8" fill="none" stroke="#e62000" stroke-width="2"/>
    <path d="M-8,8 Q-15,15 -20,8" fill="none" stroke="#e62000" stroke-width="2"/>
  </g>
  <g transform="translate(96, 32)">
    <path d="M-12,0 Q-28,-8 -32,0 Q-28,8 -12,0" class="fb-outer"/>
    <circle cx="0" cy="0" r="13" class="fb-outer" />
    <circle cx="0" cy="0" r="11" class="fb-mid" />
    <circle cx="1" cy="0" r="7" class="fb-inner" />
    <circle cx="2" cy="0" r="4" class="fb-core" />
    <path d="M-6,-9 Q-14,-16 -18,-7" fill="none" stroke="#e62000" stroke-width="2"/>
    <path d="M-6,9 Q-14,16 -18,7" fill="none" stroke="#e62000" stroke-width="2"/>
  </g>
  <g transform="translate(160, 32)">
    <path d="M-14,0 Q-26,-12 -34,0 Q-26,12 -14,0" class="fb-outer"/>
    <circle cx="0" cy="0" r="15" class="fb-outer" />
    <circle cx="0" cy="0" r="9" class="fb-mid" />
    <circle cx="1" cy="0" r="5" class="fb-inner" />
    <circle cx="2" cy="0" r="2" class="fb-core" />
    <path d="M-9,-7 Q-18,-14 -22,-9" fill="none" stroke="#e62000" stroke-width="2"/>
    <path d="M-9,7 Q-18,14 -22,9" fill="none" stroke="#e62000" stroke-width="2"/>
  </g>
  <g transform="translate(224, 32)">
    <path d="M-10,0 Q-27,-9 -31,0 Q-27,9 -10,0" class="fb-outer"/>
    <circle cx="0" cy="0" r="14" class="fb-outer" />
    <circle cx="0" cy="0" r="10" class="fb-mid" />
    <circle cx="1" cy="0" r="6" class="fb-inner" />
    <circle cx="2" cy="0" r="3" class="fb-core" />
    <path d="M-7,-10 Q-16,-18 -21,-8" fill="none" stroke="#ff8c00" stroke-width="2"/>
    <path d="M-7,10 Q-16,18 -21,8" fill="none" stroke="#ff8c00" stroke-width="2"/>
  </g>
</svg>`)}`,
  "background": `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="2200" height="540" viewBox="0 0 2200 540">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4aa1ff"/>
      <stop offset="0.6" stop-color="#bce0ff"/>
      <stop offset="1" stop-color="#fdffdf"/>
    </linearGradient>
  </defs>
  <rect width="2200" height="540" fill="url(#sky)"/>
  
  <circle cx="340" cy="145" r="80" fill="#fff" opacity="0.9"/>
  <!-- clouds -->
  <path d="M 120 180 Q 150 150 180 180 Q 210 160 240 180 Q 270 190 240 210 L 120 210 Z" fill="#fff" opacity="0.6"/>
  <path d="M 620 120 Q 650 90 680 120 Q 710 100 740 120 Q 770 130 740 150 L 620 150 Z" fill="#fff" opacity="0.5"/>
  <path d="M 1120 200 Q 1150 170 1180 200 Q 1210 180 1240 200 Q 1270 210 1240 230 L 1120 230 Z" fill="#fff" opacity="0.7"/>

  <!-- bg hills -->
  <path d="M0 460 Q 240 330 480 460 T 960 460 T 1440 460 T 1920 460 T 2400 460 L 2400 540 L 0 540 Z" fill="#aee2ff" opacity="0.8"/>
  <path d="M-200 480 Q 100 360 400 480 T 1000 480 T 1600 480 T 2200 480 T 2800 480 L 2400 540 L 0 540 Z" fill="#88cffd" opacity="0.9"/>
  
  <!-- trees layer -->
  <g fill="#4ea677" opacity="0.8">
    <polygon points="120,440 100,500 140,500"/>
    <polygon points="120,410 105,470 135,470"/>
    <polygon points="320,450 290,520 350,520"/>
    <polygon points="320,420 300,480 340,480"/>
    <polygon points="760,430 740,490 780,490"/>
    <polygon points="1260,450 1240,510 1280,510"/>
    <polygon points="1720,440 1690,510 1750,510"/>
  </g>
</svg>`)}`,
  "tiles1": tileSheetAsset({ body: "#875c40", top: "#5cc259", topLine: "#4dad4a", dirtLine: "#704b33" }),
  "tiles2": tileSheetAsset({ body: "#a86a3a", top: "#e8b36a", topLine: "#d19a52", dirtLine: "#7c4a26" }),
  "tiles3": tileSheetAsset({ body: "#16324d", top: "#4fd2ff", topLine: "#2fb8e8", dirtLine: "#0e2438" }),
  "tiles4": tileSheetAsset({ body: "#3b3e46", top: "#5f636e", topLine: "#4c505a", dirtLine: "#26282e" }),
  "far1": svgAsset(2200, 540, `<defs><linearGradient id="sk1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#aee6ff"/><stop offset="1" stop-color="#eafcff"/></linearGradient></defs><rect width="2200" height="540" fill="url(#sk1)"/><circle cx="330" cy="150" r="70" fill="#fff" opacity="0.95"/><circle cx="1400" cy="120" r="40" fill="#fff" opacity="0.8"/><path d="M 60 190 Q 110 150 160 190 Q 210 170 260 190 Q 300 205 270 225 L 90 225 Z" fill="#fff" opacity="0.8"/><path d="M 1050 170 Q 1100 130 1150 170 Q 1200 150 1250 170 Q 1290 185 1260 205 L 1080 205 Z" fill="#fff" opacity="0.7"/><path d="M 1750 200 Q 1800 160 1850 200 Q 1900 180 1950 200 Q 1990 215 1960 235 L 1780 235 Z" fill="#fff" opacity="0.65"/><path d="M0 420 Q 280 300 560 420 T 1120 420 T 1680 420 T 2240 420 L 2200 540 L 0 540 Z" fill="#b3e4ff" opacity="0.9"/><path d="M-260 470 Q 160 360 580 470 T 1420 470 T 2260 470 L 2200 540 L 0 540 Z" fill="#8fd2ff" opacity="0.85"/>`),
  "near1": svgAsset(2200, 540, `<g fill="#3f9e63" opacity="0.85"><polygon points="140,430 110,500 170,500"/><polygon points="140,400 118,470 162,470"/><polygon points="560,440 520,500 600,500"/><polygon points="560,415 535,475 585,475"/><polygon points="980,435 950,500 1010,500"/><polygon points="1440,440 1400,500 1480,500"/><polygon points="1440,415 1415,475 1465,475"/><polygon points="1980,430 1950,500 2010,500"/></g><ellipse cx="300" cy="500" rx="90" ry="26" fill="#2f8a52" opacity="0.7"/><ellipse cx="1200" cy="505" rx="120" ry="30" fill="#2f8a52" opacity="0.7"/><ellipse cx="1900" cy="500" rx="80" ry="24" fill="#2f8a52" opacity="0.7"/>`),
  "far2": svgAsset(2200, 540, `<defs><linearGradient id="sk2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9d5c"/><stop offset="0.55" stop-color="#ffc47e"/><stop offset="1" stop-color="#ffe9c0"/></linearGradient></defs><rect width="2200" height="540" fill="url(#sk2)"/><circle cx="1100" cy="240" r="130" fill="#fff3c9" opacity="0.95"/><circle cx="1100" cy="240" r="160" fill="#ffd76a" opacity="0.35"/><g fill="#8a4a6e" opacity="0.55"><path d="M0 480 L 130 300 L 260 480 Z"/><path d="M200 480 L 360 260 L 520 480 Z"/><path d="M560 480 L 700 340 L 840 480 Z"/><path d="M900 480 L 1080 270 L 1260 480 Z"/><path d="M1380 480 L 1540 330 L 1700 480 Z"/><path d="M1780 480 L 1960 280 L 2140 480 Z"/><path d="M-140 480 L 0 340 L 140 480 Z"/></g>`),
  "near2": svgAsset(2200, 540, `<g fill="#b06a2f" opacity="0.9"><ellipse cx="180" cy="500" rx="120" ry="34"/><ellipse cx="760" cy="505" rx="140" ry="38"/><ellipse cx="1500" cy="500" rx="110" ry="30"/><ellipse cx="2060" cy="502" rx="130" ry="36"/></g><g fill="#7e4a1e" opacity="0.95"><rect x="360" y="400" width="30" height="100" rx="15"/><rect x="330" y="415" width="22" height="42" rx="11"/><rect x="398" y="430" width="22" height="36" rx="11"/><rect x="1200" y="390" width="32" height="110" rx="16"/><rect x="1165" y="410" width="22" height="44" rx="11"/><rect x="1240" y="425" width="22" height="38" rx="11"/><rect x="1830" y="405" width="28" height="95" rx="14"/><rect x="1800" y="420" width="22" height="40" rx="11"/><rect x="1865" y="435" width="22" height="36" rx="11"/></g>`),
  "far3": svgAsset(2200, 540, `<defs><linearGradient id="sk3" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#081527"/><stop offset="1" stop-color="#14304c"/></linearGradient></defs><rect width="2200" height="540" fill="url(#sk3)"/><g fill="#1d4a6b"><path d="M120 540 L 170 300 L 220 540 Z"/><path d="M380 540 L 450 230 L 520 540 Z"/><path d="M760 540 L 800 340 L 840 540 Z"/><path d="M1040 540 L 1120 210 L 1200 540 Z"/><path d="M1480 540 L 1530 330 L 1580 540 Z"/><path d="M1840 540 L 1900 250 L 1960 540 Z"/><path d="M2100 540 L 2140 360 L 2180 540 Z"/></g><g fill="#6fe8ff"><polygon points="170,300 158,250 182,250"/><polygon points="450,230 436,180 464,180"/><polygon points="1120,210 1106,160 1134,160"/><polygon points="1900,250 1888,205 1912,205"/></g>`),
  "near3": svgAsset(2200, 540, `<g fill="#0e2a42"><path d="M0 540 L 0 470 L 60 400 L 130 470 L 200 430 L 260 480 L 300 540 Z"/><path d="M420 540 L 460 420 L 510 540 Z"/><path d="M820 540 L 880 380 L 940 540 Z"/><path d="M1280 540 L 1330 440 L 1380 540 Z"/><path d="M1700 540 L 1760 390 L 1820 540 Z"/><path d="M1980 540 L 2040 450 L 2100 540 Z"/></g><g fill="#4fc3f7" opacity="0.9"><polygon points="880,380 870,340 890,340"/><polygon points="1760,390 1750,355 1770,355"/></g><circle cx="500" cy="140" r="3" fill="#9be9ff"/><circle cx="1400" cy="200" r="2.5" fill="#9be9ff"/><circle cx="2000" cy="120" r="3" fill="#9be9ff"/><circle cx="900" cy="90" r="2" fill="#9be9ff"/>`),
  "far4": svgAsset(2200, 540, `<defs><linearGradient id="sk4" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141426"/><stop offset="1" stop-color="#2c2c46"/></linearGradient></defs><rect width="2200" height="540" fill="url(#sk4)"/><g fill="#33334f"><ellipse cx="200" cy="150" rx="190" ry="60"/><ellipse cx="500" cy="190" rx="240" ry="70"/><ellipse cx="900" cy="140" rx="200" ry="55"/><ellipse cx="1300" cy="180" rx="260" ry="75"/><ellipse cx="1800" cy="150" rx="220" ry="60"/><ellipse cx="2100" cy="200" rx="200" ry="65"/></g><g fill="#ffd97a" opacity="0.9"><path d="M520 30 L 490 120 L 520 120 L 490 230 L 550 130 L 520 130 L 545 40 Z"/><path d="M1560 40 L 1530 130 L 1560 130 L 1530 240 L 1590 140 L 1560 140 L 1585 50 Z"/></g><g fill="#444464" opacity="0.8"><path d="M0 420 Q 200 360 400 420 T 800 420 T 1200 420 T 1600 420 T 2000 420 T 2400 420 L 2200 540 L 0 540 Z"/></g>`),
  "near4": svgAsset(2200, 540, `<g fill="#232331"><path d="M0 540 L 0 470 L 90 400 L 180 480 L 280 440 L 360 490 L 460 420 L 560 480 L 660 450 L 760 500 L 860 430 L 960 480 L 1060 460 L 1160 500 L 1260 440 L 1360 485 L 1460 430 L 1560 490 L 1660 450 L 1760 495 L 1860 440 L 1960 490 L 2060 455 L 2160 495 L 2200 470 L 2200 540 Z"/></g><circle cx="300" cy="500" r="3" fill="#ff8c3a" opacity="0.8"/><circle cx="700" cy="490" r="2.5" fill="#ff8c3a" opacity="0.8"/><circle cx="1200" cy="495" r="3" fill="#ff8c3a" opacity="0.8"/><circle cx="1800" cy="485" r="2.5" fill="#ff8c3a" opacity="0.8"/><g fill="#ff8c3a" opacity="0.5"><circle cx="150" cy="430" r="2"/><circle cx="900" cy="420" r="2"/><circle cx="2000" cy="430" r="2"/></g>`),
  "powerups": svgAsset(192, 48, `<g transform="translate(24,24)"><circle cx="0" cy="6" r="16" fill="#000" opacity="0.25"/><rect x="-10" y="2" width="20" height="13" rx="5" fill="#f3d9b1"/><path d="M-16 0 Q 0 -17 16 0 Z" fill="#ff4747"/><circle cx="-7" cy="-7" r="3" fill="#fff"/><circle cx="6" cy="-9" r="3" fill="#fff"/><circle cx="0" cy="-3" r="2.4" fill="#fff"/><circle cx="-5" cy="3" r="2" fill="#111"/><circle cx="5" cy="3" r="2" fill="#111"/><path d="M-4 7 Q0 10 4 7" stroke="#111" stroke-width="1.5" fill="none"/></g><g transform="translate(72,24)"><circle r="17" fill="#ffe066" opacity="0.35"/><polygon points="0,-15 4.4,-4.6 15.5,-3.6 7,3.6 9.6,14.3 0,8.4 -9.6,14.3 -7,3.6 -15.5,-3.6 -4.4,-4.6" fill="#ffdf30" stroke="#cc8e00" stroke-width="2" stroke-linejoin="round"/><circle cx="-5" cy="-1" r="2.2" fill="#111"/><circle cx="5" cy="-1" r="2.2" fill="#111"/><path d="M-3 4 Q0 7 3 4" stroke="#111" stroke-width="1.5" fill="none"/></g><g transform="translate(120,24)"><circle cx="0" cy="5" r="8" fill="#fff3d6"/><circle cx="0" cy="-8" r="6.5" fill="#ff8c3a"/><circle cx="0" cy="8" r="6.5" fill="#ff8c3a"/><circle cx="-8" cy="0" r="6.5" fill="#ff8c3a"/><circle cx="8" cy="0" r="6.5" fill="#ff8c3a"/><circle cx="-6" cy="-6" r="6.5" fill="#ff8c3a"/><circle cx="6" cy="-6" r="6.5" fill="#ff8c3a"/><circle cx="-6" cy="6" r="6.5" fill="#ff8c3a"/><circle cx="6" cy="6" r="6.5" fill="#ff8c3a"/><circle cx="-3.5" cy="4" r="2" fill="#111"/><circle cx="3.5" cy="4" r="2" fill="#111"/><path d="M-2 8 Q0 10 2 8" stroke="#111" stroke-width="1.5" fill="none"/></g>`),
  "spring": springSheetAsset(),
  "stalactite": svgAsset(160, 100, `<g transform="translate(40,0)"><path d="M6 0 L34 0 L30 44 Q 26 62 20 70 Q 18 74 16 76 L 12 66 Q 8 52 6 0 Z" fill="#bfefff" opacity="0.95"/><path d="M14 4 L 20 34 L 24 10 Z" fill="#e8fbff" opacity="0.85"/><path d="M8 12 L 12 26" stroke="#8fd0e8" stroke-width="2" opacity="0.7"/></g><g transform="translate(120,0)"><path d="M6 0 L34 0 L30 44 Q 26 62 20 70 Q 18 74 16 76 L 12 66 Q 8 52 6 0 Z" fill="#a8dff0" opacity="0.95"/><path d="M14 4 L 20 34 L 24 10 Z" fill="#d6f4ff" opacity="0.85"/><path d="M14 40 L 20 48 M 20 48 L 18 58" stroke="#5aa8c4" stroke-width="2.5" fill="none"/><path d="M10 22 L 16 30" stroke="#5aa8c4" stroke-width="2" fill="none"/></g>`),
  "lightning": lightningSheetAsset(),
  "boss": bossSheetAsset()
};
