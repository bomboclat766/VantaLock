const crypto = require('crypto');
const argon2 = require('argon2');

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
  hashLength: 32
};

function generateDecoyContent() {
  const now = new Date().toISOString();
  return [
    // Financial (3 entries)
    {
      id: crypto.randomBytes(16).toString('hex'),
      title: 'City Power & Light Statement',
      category: 'Financial',
      username: 'acc_7829104',
      password: '',
      url: 'https://billing.citypowerlight.com',
      notes: 'Monthly utility billing statement summary. Account balance: $142.80 due 15th.',
      created_at: now
    },
    {
      id: crypto.randomBytes(16).toString('hex'),
      title: 'Apex National Bank Summary',
      category: 'Financial',
      username: 'apex_client_9941',
      password: '',
      url: 'https://online.apexnatbank.com',
      notes: 'Savings account checking summary. Ref statement #2026-08-99.',
      created_at: now
    },
    {
      id: crypto.randomBytes(16).toString('hex'),
      title: 'High-Yield Savings Login',
      category: 'Financial',
      username: 'j.sterling.vault@mailnet.com',
      password: 'P' + crypto.randomBytes(6).toString('hex') + '!9',
      url: 'https://secure.apexnatbank.com/login',
      notes: 'Primary personal savings portal access credentials.',
      created_at: now
    },
    // Legal (2 entries)
    {
      id: crypto.randomBytes(16).toString('hex'),
      title: 'Residential Lease Agreement',
      category: 'Legal',
      username: 'Tenant ID: TL-4081',
      password: '',
      url: 'https://portal.oakwoodproperties.com',
      notes: 'Oakwood Apartments Unit 4B Lease Agreement. Term: Oct 2025 - Oct 2026. Deposit: $2,400.',
      created_at: now
    },
    {
      id: crypto.randomBytes(16).toString('hex'),
      title: 'Sovereign Mutual Life Policy',
      category: 'Legal',
      username: 'Policy #SML-992014-B',
      password: '',
      url: 'https://claims.sovereignmutual.com',
      notes: 'Term Life Coverage policy documentation reference. Representative: Sarah Jenkins.',
      created_at: now
    },
    // Personal (2–3 entries)
    {
      id: crypto.randomBytes(16).toString('hex'),
      title: 'ProtonMail Secondary Inbox',
      category: 'Personal',
      username: 'j.sterling.private@pm.me',
      password: 'K' + crypto.randomBytes(7).toString('hex') + '#2',
      url: 'https://mail.proton.me',
      notes: 'Encrypted personal email address for non-commercial correspondence.',
      created_at: now
    },
    {
      id: crypto.randomBytes(16).toString('hex'),
      title: 'CineStream Premium Account',
      category: 'Personal',
      username: 'sterling_family_pass',
      password: 'v' + crypto.randomBytes(6).toString('hex') + '$4',
      url: 'https://cinestream.tv/signin',
      notes: '4K Family Subscription Plan.',
      created_at: now
    }
  ];
}

module.exports = {
  ARGON2_OPTIONS,
  generateDecoyContent
};
