(() => {
  'use strict';
  const cfg = window.LANDING_CONFIG || {};
  const presets = {
    emeraldGold:{primary:'#173B2D',primary2:'#244D39',accent:'#E7C981',accent2:'#F3DDA7',background:'#F7F4EA',surface:'#FFFDF8',surface2:'#F3F5ED',text:'#17251D',muted:'#667268',border:'#D9D4C5',danger:'#AD3131',success:'#287044',onPrimary:'#FFFFFF',onAccent:'#173526'},
    blackGold:{primary:'#151515',primary2:'#292929',accent:'#D8B56A',accent2:'#F0D89C',background:'#F6F3EC',surface:'#FFFFFF',surface2:'#F0EEE8',text:'#171717',muted:'#6D6A64',border:'#D9D3C7',danger:'#A92E2E',success:'#2E7045',onPrimary:'#FFFFFF',onAccent:'#171717'},
    maroonGold:{primary:'#4A1831',primary2:'#672542',accent:'#D9B56C',accent2:'#F1D79E',background:'#FAF4F5',surface:'#FFFDFD',surface2:'#F7ECEF',text:'#2C1821',muted:'#765E68',border:'#E1CED5',danger:'#B12D3B',success:'#34734B',onPrimary:'#FFFFFF',onAccent:'#321421'},
    navyGold:{primary:'#142A43',primary2:'#203E5E',accent:'#D6B56D',accent2:'#F0D89F',background:'#F4F7FA',surface:'#FFFFFF',surface2:'#EDF2F6',text:'#182431',muted:'#647180',border:'#D4DDE5',danger:'#B0363C',success:'#2D7351',onPrimary:'#FFFFFF',onAccent:'#15283C'},
    mochaCream:{primary:'#49352B',primary2:'#654A3C',accent:'#D9B98A',accent2:'#F1D9B6',background:'#FAF5ED',surface:'#FFFDF9',surface2:'#F4EADF',text:'#2E251F',muted:'#75685F',border:'#E2D4C4',danger:'#AD3A35',success:'#42704B',onPrimary:'#FFFFFF',onAccent:'#34271F'}
  };
  const tcfg = cfg.theme || {};
  const base = presets[tcfg.activePreset] || presets.emeraldGold;
  const t = {...base,...(tcfg.custom || {})};
  const root = document.documentElement;
  const vars = {primary:t.primary,'primary-2':t.primary2,accent:t.accent,'accent-2':t.accent2,bg:t.background,surface:t.surface,'surface-2':t.surface2,text:t.text,muted:t.muted,border:t.border,danger:t.danger,success:t.success,'on-primary':t.onPrimary,'on-accent':t.onAccent};
  Object.entries(vars).forEach(([k,v])=>v&&root.style.setProperty(`--${k}`,v));
  root.dataset.theme = tcfg.activePreset || 'emeraldGold';
  const meta=document.querySelector('meta[name="theme-color"]'); if(meta) meta.content=t.primary;
})();
