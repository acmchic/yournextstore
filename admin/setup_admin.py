from pathlib import Path
import re
root=Path(__file__).parent
p=root/'config/database.php'
s=p.read_text().replace('return [', '$configuration = [',1).replace("'prefix' => '',", "'prefix' => 'admin_',")
s+='\n// Commerce uses the same database, without the admin table namespace.\n$configuration[\'connections\'][\'store\'] = $configuration[\'connections\'][$configuration[\'default\']];\n$configuration[\'connections\'][\'store\'][\'prefix\'] = \'\';\n\nreturn $configuration;\n'
p.write_text(s)
p=root/'config/fortify.php'; p.write_text(p.read_text().replace('        Features::registration(),\n',''))
p=root/'resources/js/pages/auth/login.tsx'; s=p.read_text().replace("import { register } from '@/routes';\n",''); s=re.sub(r'<div className="text-center text-sm text-muted-foreground">.*?</div>', '', s, flags=re.S); p.write_text(s)
# Remove unused public starter pages that import registration routes after Wayfinder regenerates.
for name in ['resources/js/pages/auth/register.tsx','resources/js/pages/welcome.tsx']:
 (root/name).unlink()
p=root/'resources/js/components/app-logo.tsx'; p.write_text(p.read_text().replace('Laravel Starter Kit','Teeravo Admin'))
p=root/'resources/js/components/app-sidebar.tsx'; s=p.read_text().replace('BookOpen, FolderGit2, LayoutGrid','LayoutGrid, Package, Layers, ShoppingBag').replace("import { NavFooter } from '@/components/nav-footer';\n",''); s=re.sub(r'const footerNavItems: NavItem\[\] = \[.*?\];\n', '', s,flags=re.S); s=s.replace('    },\n];','    },\n    { title: \'Products\', href: \'/products\', icon: Package },\n    { title: \'Catalog\', href: \'/catalog\', icon: Layers },\n    { title: \'Orders\', href: \'/orders\', icon: ShoppingBag },\n];',1).replace('                <NavFooter items={footerNavItems} className="mt-auto" />\n',''); p.write_text(s)
# Copy only DB settings, never API credentials or application encryption keys.
import sys
sys.path.insert(0,'/Users/changha/workspace/Teeravo/api/.venv/lib/python3.12/site-packages')
from dotenv import dotenv_values
api=dotenv_values('/Users/changha/workspace/Teeravo/api/.env')
values={'APP_NAME':'Teeravo Admin','APP_URL':'http://localhost:8001','DB_CONNECTION':'mysql','DB_HOST':api.get('DB_HOST') or api.get('MYSQL_HOST') or '127.0.0.1','DB_PORT':api.get('DB_PORT') or api.get('MYSQL_PORT') or '3306','DB_DATABASE':api.get('DB_NAME') or api.get('MYSQL_DATABASE') or 'pod_store','DB_USERNAME':api.get('DB_USER') or api.get('MYSQL_USER') or 'root','DB_PASSWORD':api.get('DB_PASSWORD') or api.get('MYSQL_PASSWORD') or '', 'SESSION_DRIVER':'file','SESSION_COOKIE':'teeravo_admin_session','SESSION_ENCRYPT':'true','CACHE_STORE':'file','QUEUE_CONNECTION':'sync'}
def encode(v): return "'"+str(v).replace('\\','\\\\').replace("'","\\'")+"'"
p=root/'.env'; s=p.read_text()
for k,v in values.items():
 line=k+'='+encode(v)
 s=re.sub(r'^'+k+r'=.*$',lambda m:line,s,flags=re.M) if re.search(r'^'+k+'=',s,re.M) else s+'\n'+line+'\n'
p.write_text(s)
p=root/'.env.example'; s=p.read_text()
for k,v in {**values,'DB_USERNAME':'root','DB_PASSWORD':''}.items():
 line=k+'='+encode(v)
 s=re.sub(r'^'+k+r'=.*$',lambda m:line,s,flags=re.M) if re.search(r'^'+k+'=',s,re.M) else s+'\n'+line+'\n'
p.write_text(s)
