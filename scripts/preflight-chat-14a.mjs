import fs from 'node:fs';
import path from 'node:path';
const root = process.cwd();
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const files = {
  private: 'src/funcionalidades/chat/hooks/useChat.ts',
  group: 'src/funcionalidades/chat/hooks/useGroupChat.ts',
  unread: 'src/hooks/useUnreadMessages.ts',
  groupUnread: 'src/funcionalidades/chat/hooks/useGroupUnread.ts',
  previews: 'src/funcionalidades/chat/hooks/useChatPreviews.ts',
  rules: 'firestore.rules',
};
let bad = 0;
const report = (name, good, msg = '') => {
  console.log(`${good ? 'PASS' : 'BLOCK'}: ${name}${msg ? ' — ' + msg : ''}`);
  if (!good) bad++;
};
for (const [key, file] of Object.entries(files))
  report(`arquivo ${key}`, fs.existsSync(path.join(root, file)));
if (bad) {
  process.exitCode = 1;
} else {
  const code = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, read(v)]));
  report(
    'historico privado com pagina limitada',
    /limit\(20\)/.test(code.private) ||
      (/PAGE_SIZE\s*=\s*20/.test(code.private) && /limit\(PAGE_SIZE\)/.test(code.private)),
    'precisa do patch de 20 mensagens'
  );
  report(
    'historico em grupo com pagina limitada',
    /limit\(20\)/.test(code.group),
    'precisa do patch de 20 mensagens'
  );
  report(
    'leitura registrada com horario',
    /read_at/.test(code.private) && /read_at/.test(code.rules)
  );
  report(
    'contadores desvinculados da janela de 100 mensagens',
    !/where\(['"]receiverId['"],\s*['"]==['"],\s*userId\)[\s\S]{0,80}limit\(100\)/.test(
      code.unread
    ) &&
      !/where\(['"]group_id['"],\s*['"]in['"],\s*groupIds\)[\s\S]{0,80}limit\(100\)/.test(
        code.groupUnread
      ),
    'não somar uma janela limitada como total'
  );
  report(
    'previews nao contam apenas mensagens recentes',
    !/unreadCount: value\.unread/.test(code.previews),
    'contagem por conversa deve ser independente'
  );
  report(
    'regras protegem leitura de mensagens',
    /match \/messages\/\{messageId\}/.test(code.rules) &&
      /participant\(resource\.data\)/.test(code.rules)
  );
  console.log(`\n${bad === 0 ? 'PASSOU' : 'BLOQUEADO'}: ${bad} problema(s).`);
  if (bad) process.exitCode = 1;
}
