function escapeCsvCell(value) {
  const str = String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  if (/[",\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Build an RFC-4180 CSV string for the User Governance directory.
 */
export function buildUsersGovernanceCsv(users = []) {
  const headers = [
    'UID',
    'Name',
    'Email',
    'Phone',
    'Auth Method',
    'Role',
    'Account Status',
    'City',
    'Created At'
  ];

  const rows = (Array.isArray(users) ? users : []).map((u) => {
    if (!u || typeof u !== 'object') return null;
    const uid = u.uid || u.id || '';
    const name = u.name || u.displayName || '';
    const email = u.email || '';
    const phone = u.phone || u.phoneNumber || '';
    const authMethod = u.authMethod || u.provider || (u.providerData?.[0]?.providerId) || 'Email / Password';
    const role = u.role || (email === 'admin@easeland.in' ? 'ADMIN' : 'USER');
    const status = u.status || u.accountStatus || 'ACTIVE';
    const city = u.city || u.location || '';
    const createdAt = u.createdAt?.toDate ? u.createdAt.toDate().toISOString() : (u.createdAt || '');

    return [uid, name, email, phone, authMethod, role, status, city, createdAt]
      .map(escapeCsvCell)
      .join(',');
  }).filter(Boolean);

  return [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');
}

/**
 * Trigger a browser CSV file download for the provided User Governance rows.
 */
export function downloadUsersGovernanceCsv(users = [], filenamePrefix = 'easeland-users') {
  const csvContent = buildUsersGovernanceCsv(users);
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const blobUrl = URL.createObjectURL(blob);
  const dateTag = new Date().toISOString().slice(0, 10);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = `${filenamePrefix}-${dateTag}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

