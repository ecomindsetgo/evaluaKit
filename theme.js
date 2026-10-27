/* EvaluaKit v0.8 — tema accesible por consultorio, sin guardar datos clínicos localmente. */
(function(){
 const fallback='#287b70';
 const hexValid=c=>typeof c==='string'&&/^#[0-9a-fA-F]{6}$/.test(c);
 function luminance(hex){const v=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*v[0]+.7152*v[1]+.0722*v[2]}
 function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
 function mix(a,b,t){const x=[1,3,5].map(i=>parseInt(a.slice(i,i+2),16)),y=[1,3,5].map(i=>parseInt(b.slice(i,i+2),16));return '#'+x.map((n,i)=>Math.round(n*(1-t)+y[i]*t).toString(16).padStart(2,'0')).join('')}
 function apply(color){const accent=hexValid(color)?color:fallback;const foreground=contrast(accent,'#ffffff')>=4.5?'#ffffff':contrast(accent,'#172b37')>=4.5?'#172b37':(luminance(accent)>.18?'#111827':'#ffffff');const root=document.documentElement;root.style.setProperty('--accent',accent);root.style.setProperty('--accent-foreground',foreground);root.style.setProperty('--accent-soft',mix(accent,'#ffffff',.91));root.style.setProperty('--accent-line',mix(accent,'#ffffff',.7));root.style.setProperty('--accent-deep',mix(accent,'#172b37',.36));root.style.setProperty('--accent-header',mix(accent,'#102630',.78));root.style.setProperty('--accent-header-end',mix(accent,'#102630',.55));root.style.setProperty('--accent-ink',contrast(accent,'#ffffff')>=4.5?accent:mix(accent,'#172b37',.48));return accent}
 window.EK_THEME={apply};
 apply(fallback);
})();
