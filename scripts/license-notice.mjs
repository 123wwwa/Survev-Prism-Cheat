export function addLicenseNotice(code, { upstreamCommit, modifiedAt }) {
  if (!/^[a-f0-9]{40}$/.test(upstreamCommit)) throw new Error('Invalid upstream commit for license notice.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(modifiedAt) || !Number.isFinite(Date.parse(modifiedAt))) {
    throw new Error('Invalid modified date for license notice.');
  }
  return `/*!\n` +
    ` * SPDX-License-Identifier: GPL-3.0-or-later\n` +
    ` * Derived from survev/survev (GPL-3.0-or-later).\n` +
    ` * Upstream commit: ${upstreamCommit}\n` +
    ` * Upstream source: https://github.com/survev/survev/tree/${upstreamCommit}\n` +
    ` * Modified by survev-cheat-injector; modified date (UTC): ${modifiedAt}\n` +
    ` * Modifications: readable client build and injector hooks/global exports.\n` +
    ` * Modification source: https://github.com/123wwwa/survev-cheat-injector\n` +
    ` * This modified program is free software: you may redistribute it and/or\n` +
    ` * modify it under the GNU General Public License, version 3 or (at your\n` +
    ` * option) any later version. Distributed WITHOUT ANY WARRANTY; without\n` +
    ` * even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.\n` +
    ` * See LICENSE and https://www.gnu.org/licenses/gpl-3.0.html.\n` +
    ` * Bundled third-party notices are retained; see THIRD_PARTY_LICENSES.md.\n` +
    ` */\n${code}`;
}
