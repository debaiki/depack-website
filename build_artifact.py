"""Inline all assets/ images as data URIs -> artifact.html (self-contained, for sharing)."""
import re,base64,mimetypes,os
s=open('index.html',encoding='utf-8').read()
def inl(m):
    path=m.group(1); mt=mimetypes.guess_type(path)[0] or 'application/octet-stream'
    if path.endswith('.webp'): mt='image/webp'
    data=base64.b64encode(open(path,'rb').read()).decode()
    return f'"data:{mt};base64,{data}"'
out=re.sub(r'"(assets/[^"]+)"',inl,s)
# artifact wrapper adds its own doctype/html/head/body — strip ours, keep <title> at top
head=re.search(r'<head>(.*?)</head>',out,re.S).group(1)
body=re.search(r'<body>(.*?)</body>',out,re.S).group(1)
pass
open('artifact.html','w',encoding='utf-8').write(head.strip()+"\n"+body)
print('artifact.html',os.path.getsize('artifact.html')//1024,'KB')
