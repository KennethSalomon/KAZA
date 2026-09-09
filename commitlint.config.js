// note : Conventional Commits — application mécanique de la règle §4 du
// CLAUDE.md via un hook git commit-msg. Les scopes reconnus reflètent les
// domaines fonctionnels KAZA (ui, auth, chat, payment, lease, residence,
// admin, notif, api, db, ci, deps).

/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'style', 'test', 'docs', 'chore', 'perf', 'build', 'ci'],
    ],
    'scope-enum': [
      1,
      'always',
      [
        'ui',
        'auth',
        'chat',
        'payment',
        'lease',
        'residence',
        'admin',
        'notif',
        'api',
        'db',
        'ci',
        'deps',
        'edge',
        'seo',
        'landing',
        'dashboard',
        'onboarding',
        'tests',
      ],
    ],
    'subject-case': [0],
    'header-max-length': [2, 'always', 72],
  },
};
