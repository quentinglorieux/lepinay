// Génère l'entrée d'un compte pour la variable d'environnement ADMIN_USERS.
// Usage : node scripts/admin-hash-password.mjs "prenom@exemple.fr" "Prénom Nom"
// Le mot de passe est demandé au clavier (non affiché).
import { randomBytes, scryptSync } from 'node:crypto';

const [email, name] = process.argv.slice(2);
if (!email || !name) {
  console.error('Usage : node scripts/admin-hash-password.mjs "email" "Nom affiché"');
  process.exit(1);
}

function ask(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n' || ch === '\u0004') {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.off('data', onData);
        process.stdout.write('\n');
        resolve(value);
      } else if (ch === '\u0003') {
        process.exit(130);
      } else if (ch === '\u007f') {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

const password = await ask('Mot de passe : ');
const confirm = await ask('Confirmer : ');
if (password !== confirm) {
  console.error('Les deux saisies ne correspondent pas.');
  process.exit(1);
}
if (password.length < 10) {
  console.error('Mot de passe trop court (10 caractères minimum).');
  process.exit(1);
}
const salt = randomBytes(16);
const hash = `scrypt:${salt.toString('base64')}:${scryptSync(password, salt, 64).toString('base64')}`;
console.log('\nÀ ajouter dans le tableau JSON de ADMIN_USERS :\n');
console.log(JSON.stringify({ email, name, hash }));
