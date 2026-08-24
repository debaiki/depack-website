# -*- coding: utf-8 -*-
"""Generate careers.html from index.html (shared head/CSS/nav/footer/scripts)."""
import re
s=open('index.html',encoding='utf-8').read()

# head adjustments
s=s.replace('<title>DEPACK</title>','<title>Careers — DEPACK</title>')
s=re.sub(r'<meta name="description" content="[^"]*">',
 '<meta name="description" content="Careers at DEPACK — join the Egyptian-Austrian team behind the region\'s rigid plastic food packaging. Send us your CV.">',s)
s=s.replace('<link rel="canonical" href="https://www.depack.co/">','<link rel="canonical" href="https://www.depack.co/careers.html">')
s=s.replace('<link rel="alternate" hreflang="en" href="https://www.depack.co/">','<link rel="alternate" hreflang="en" href="https://www.depack.co/careers.html">')
s=s.replace('<link rel="alternate" hreflang="fr" href="https://www.depack.co/?lang=fr">','<link rel="alternate" hreflang="fr" href="https://www.depack.co/careers.html?lang=fr">')
s=s.replace('<link rel="alternate" hreflang="ar" href="https://www.depack.co/?lang=ar">','<link rel="alternate" hreflang="ar" href="https://www.depack.co/careers.html?lang=ar">')
s=s.replace('<link rel="alternate" hreflang="x-default" href="https://www.depack.co/">','<link rel="alternate" hreflang="x-default" href="https://www.depack.co/careers.html">')
s=s.replace('<meta property="og:title" content="DEPACK — Packaging that makes a statement">','<meta property="og:title" content="Careers at DEPACK">')
s=s.replace('<meta property="og:url" content="https://www.depack.co/">','<meta property="og:url" content="https://www.depack.co/careers.html">')

# extract careers section from the existing careers page (it no longer lives in index.html)
prev=open('careers.html',encoding='utf-8').read()
m=re.search(r'<section id="careers">.*?</section>',prev,re.S)
careers=m.group(0)

# new main
new_main='''<main id="top">
<section id="chero">
  <div class="wrap">
    <h1>Careers at DEPACK</h1>
    <p>Join an Egyptian-Austrian team that makes the region's food packaging.</p>
    <a class="back" href="/">← Back to depack.co</a>
  </div>
</section>

'''+careers+'''

</main>'''
s=re.sub(r'<main id="top">.*?</main>',new_main,s,flags=re.S)

# strip loader (no hero intro needed) -> keep but instant
s=s.replace('setTimeout(()=>document.body.classList.add(\'ready\'),reduced?0:900));','setTimeout(()=>document.body.classList.add(\'ready\'),0));')

# nav/footer links -> absolute to home page anchors
for a in ['#custom','#hybrid','#ffs','#fb','#studio','#global','#contact']:
    s=s.replace('href="%s"'%a,'href="/%s"'%a)
# careers links point to this page (self)
s=s.replace('href="/careers.html"','href="/careers.html"')
open('careers.html','w',encoding='utf-8').write(s)
print('careers.html written,',len(s)//1024,'KB')
