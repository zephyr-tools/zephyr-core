# Legal Notice and Terms of Use

**Last updated:** 2026-04-17

This document governs your use of Zephyr (the "Software"). By downloading,
installing, running, or otherwise using the Software, you acknowledge that
you have read, understood, and agree to be bound by this notice in full. If
you do not agree, you must not use the Software.

> **This document is not legal advice.** It is a good-faith statement of the
> Software's purpose, the terms under which it is made available, and the
> obligations of its users. It is not a substitute for qualified legal
> counsel in your jurisdiction.

---

## 1. What Zephyr Is

Zephyr is a free, open-source desktop application with **two distinct and
independent functions**:

### 1.1 A release-information and discovery tool

Zephyr aggregates publicly available **metadata** about software releases —
primarily video games — from public sources such as `predb.net`, the Steam
public storefront, YouTube, and general-purpose AI services (Google Gemini).
The information surfaced includes release names, scene group tags, release
dates, cover artwork, textual descriptions, genres, screenshots, and
trailers.

**Metadata is information about a release, not the release itself.** Zephyr
does not host, mirror, cache (beyond local convenience caches of artwork
thumbnails), re-publish, or otherwise distribute any copyrighted creative
work. Displaying factual information about the existence of a release is
analogous to a library catalogue listing a book — it conveys that a work
exists, not the work itself.

### 1.2 A general-purpose BitTorrent client

Zephyr includes a standard BitTorrent client (built on WebTorrent), with
optional integration to a user-provided Real-Debrid account for
higher-performance downloads. Like any BitTorrent client
(qBittorrent, Transmission, Deluge, µTorrent, WebTorrent Desktop, and
others), it is a **neutral transport for a widely used peer-to-peer
protocol**. It will load and process any valid magnet link or `.torrent`
file that the user supplies or selects — exactly as a web browser will load
any URL a user enters.

BitTorrent has a long and well-documented history of substantial
non-infringing use, including but not limited to:

- Distribution of Linux distributions (Debian, Ubuntu, Arch, Fedora, etc.)
- Software updates for large games (Blizzard, Wargaming, CCP)
- Internet Archive public-domain media
- Academic datasets (e.g., research corpora)
- Independent films, podcasts, music, and software released under
  permissive or public-domain licences
- Game patches, mods, and community-distributed assets
- Decentralised web publishing

The BitTorrent client in Zephyr is no more specific to infringing use than a
web browser is specific to infringing use.

---

## 2. What Zephyr Is Not

Zephyr does not, and the Software's authors, contributors, and maintainers
do not:

- Host, store, mirror, cache long-term, upload, or distribute any
  copyrighted creative work that is not their own or not lawfully licensed
- Operate, control, or affiliate with `predb.net`, any BitTorrent index,
  any tracker, Real-Debrid, Steam, YouTube, Google, VirusTotal, or any
  other third-party service
- Provide, bundle, recommend, or link to cracks, keygens, DRM-circumvention
  tools, or any content that is itself infringing
- Encourage, induce, solicit, condone, or facilitate copyright infringement
  or any other unlawful activity
- Curate, filter, rank, or otherwise promote infringing material over
  lawful material — the discovery and search features are neutral with
  respect to a release's legal status, which the Software cannot in the
  general case determine

The Software is a **tool**. Like a printer, a filesystem, a camera, a web
browser, or a text editor, it is capable of being used lawfully or
unlawfully, and the responsibility for a particular use lies with the
person who directs it.

---

## 3. Your Responsibilities as a User

You are solely and exclusively responsible for:

1. **Lawful use.** Ensuring that your use of the Software — including every
   download you initiate, every torrent you add, every file you share via
   the BitTorrent protocol, and every piece of content you access — is
   lawful in your jurisdiction and in every jurisdiction whose laws apply
   to your conduct.
2. **Respecting copyright and other intellectual property rights.** You
   must not use the Software to obtain, distribute, or make available any
   work that you do not have the right to obtain, distribute, or make
   available.
3. **Complying with third-party terms of service.** The Software
   interoperates with services operated by third parties. Your use of those
   services is governed exclusively by the terms each provider publishes.
   You are responsible for reading and complying with them. This includes,
   without limitation:
   - [Steam Subscriber Agreement](https://store.steampowered.com/subscriber_agreement/)
   - [Google APIs Terms of Service](https://developers.google.com/terms) and
     the [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms)
   - [YouTube API Services Terms](https://developers.google.com/youtube/terms/api-services-terms-of-service)
   - [Real-Debrid Terms](https://real-debrid.com/terms)
   - [VirusTotal Terms of Service](https://docs.virustotal.com/docs/terms-of-service)
   - The terms of any BitTorrent tracker you connect to
4. **Your API keys and accounts.** Protecting, rotating, and revoking any
   API keys or account credentials you configure in the Software. The
   Software stores these values locally on your device only.
5. **Your network environment.** Ensuring your use of peer-to-peer
   networking is permitted by your internet service provider, network
   administrator, employer, school, or landlord as applicable.
6. **Tax, export-control, and sanctions compliance.** Ensuring your use of
   the Software does not violate applicable export-control laws, sanctions
   regimes, or any other regulations that apply to you.

---

## 4. Prohibited Uses

You agree that you will **not** use the Software to:

- Download, upload, seed, share, or otherwise distribute any work that
  infringes copyright, trademark, trade-secret, patent, publicity, privacy,
  or any other right
- Circumvent technological protection measures (DRM) in violation of
  applicable law
- Access, distribute, or create material that is unlawful in your
  jurisdiction, including child sexual abuse material, non-consensual
  intimate imagery, or content that incites violence
- Distribute malware, ransomware, spyware, stalkerware, or any other
  harmful code
- Violate the terms of service of any third-party service the Software
  interacts with
- Evade lawful network controls, content filtering, or geographic
  restrictions in violation of applicable law
- Conduct unauthorised security testing against the Software's upstream
  dependencies or third-party services

Violation of this section is a material breach of these terms and
terminates your licence to use the Software immediately and automatically.

---

## 5. Intellectual Property and Rightsholder Concerns

The Software itself is released under the MIT licence (see
[LICENSE](LICENSE)). Trademarks, product names, cover artwork, screenshots,
and trailers surfaced by the Software belong to their respective owners
and are displayed for informational and identification purposes only.

**If you are a rightsholder** and you have a concern about how your work is
referenced by the Software — for example, if metadata the Software surfaces
from a public source is inaccurate, or if you believe a specific feature is
likely to be misused — please open an issue on the project's GitHub
repository. The maintainers will engage with good-faith concerns promptly.

Because Zephyr does not host any creative work, it is not in a position to
"take down" content. If your concern is with a third-party source (for
example, content hosted on `predb.net`, on a BitTorrent index, or on a
tracker), please address it to the operator of that service directly.

---

## 6. No Warranty

THE SOFTWARE IS PROVIDED **"AS IS"**, WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NONINFRINGEMENT. THE AUTHORS,
CONTRIBUTORS, AND MAINTAINERS MAKE NO REPRESENTATION THAT THE SOFTWARE
WILL BE ERROR-FREE, SECURE, UNINTERRUPTED, OR SUITABLE FOR ANY PARTICULAR
PURPOSE.

**The Software includes a "virus scan" feature that uses Windows Defender
and, optionally, VirusTotal hash lookups. This is a convenience layer only.
It is not a substitute for running a fully updated, independent endpoint
security solution, and it does not guarantee that any file is safe. Running
unknown executables always carries risk. You assume that risk.**

---

## 7. Limitation of Liability

TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE
AUTHORS, CONTRIBUTORS, OR MAINTAINERS OF THE SOFTWARE BE LIABLE FOR ANY
CLAIM, DAMAGES, OR OTHER LIABILITY — WHETHER IN AN ACTION OF CONTRACT,
TORT, STRICT LIABILITY, OR OTHERWISE — ARISING FROM, OUT OF, OR IN
CONNECTION WITH THE SOFTWARE, YOUR USE OF THE SOFTWARE, OR ANY CONTENT YOU
ACCESS, DOWNLOAD, OR DISTRIBUTE THROUGH THE SOFTWARE. THIS INCLUDES,
WITHOUT LIMITATION, DIRECT, INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL,
EXEMPLARY, OR PUNITIVE DAMAGES; LOST PROFITS, LOST DATA, OR BUSINESS
INTERRUPTION; LEGAL FEES, FINES, SETTLEMENTS, OR JUDGMENTS ARISING FROM
THIRD-PARTY CLAIMS; AND DAMAGES ARISING FROM MALWARE, DATA LOSS, OR
PRIVACY INCIDENTS CONNECTED WITH YOUR USE OF THE SOFTWARE.

Some jurisdictions do not allow the exclusion or limitation of certain
warranties or liabilities. To the extent such exclusions or limitations are
prohibited, the authors' liability is limited to the maximum extent
permitted by law.

---

## 8. Indemnification

You agree to defend, indemnify, and hold harmless the authors, contributors,
and maintainers of the Software from and against any and all claims,
liabilities, damages, losses, costs, expenses, and fees (including
reasonable attorneys' fees) arising from or related to:

1. Your use of the Software;
2. Any content you access, download, upload, share, or distribute through
   the Software;
3. Your violation of these terms;
4. Your violation of any law, regulation, or third-party right, including
   any intellectual-property right; and
5. Any dispute between you and any third party arising from your use of the
   Software.

---

## 9. Independent, Non-Commercial, and Unaffiliated

Zephyr is developed and maintained as a personal, open-source project. As of
the "Last updated" date above, the following statements of fact apply:

- **Free software.** The Software is distributed free of charge under the
  [MIT licence](LICENSE). There is no paid tier, no premium edition, no
  subscription, no in-app purchase, and no advertising.
- **No revenue from use.** The authors, contributors, and maintainers
  receive **no money of any kind** in connection with the Software — no
  donations are solicited in-product, no affiliate or referral commissions
  are earned on any third-party service the Software interacts with
  (including, without limitation, Real-Debrid, Steam, Google, YouTube,
  VirusTotal, or any BitTorrent index, tracker, or seedbox provider), and
  no revenue-sharing, bounty, or sponsorship arrangement exists with any
  such provider.
- **No financial interest in what users do with it.** The authors derive
  no financial benefit, direct or indirect, from what any user chooses to
  search for, download, stream, or share through the Software. The
  Software's behaviour is identical whether a user downloads a Linux ISO
  or anything else.
- **No telemetry.** The Software does not collect analytics or usage
  telemetry. Network requests are made only to the third-party APIs the
  user has configured or that are required to answer a specific user
  action (for example, fetching a piece of cover art the user is
  currently viewing).
- **No affiliation.** The authors and contributors have no affiliation
  with, and no endorsement from, Valve Corporation (Steam), Google LLC,
  YouTube LLC, Real-Debrid SRL, VirusTotal / Chronicle Security,
  Microsoft Corporation (Windows Defender), the operators of `predb.net`,
  or any BitTorrent tracker, index, or other third-party service. All
  product names, trademarks, and registered trademarks are the property
  of their respective owners.

These statements are a representation of present fact, not a licence
condition. If any of them ceases to be true in the future, this notice
will be updated to reflect the change before the change takes effect.

---

## 10. Changes to This Notice

The authors may update this notice from time to time. Material changes will
be reflected by updating the "Last updated" date at the top of this file
and by a commit to the project's public repository. Continued use of the
Software after a change constitutes acceptance of the updated terms.

---

## 11. Severability

If any provision of this notice is held by a court of competent
jurisdiction to be invalid or unenforceable, that provision shall be
enforced to the maximum extent permitted, and the remaining provisions
shall remain in full force and effect.

---

## 12. Entire Agreement

This notice, together with the [LICENSE](LICENSE) file, constitutes the
entire agreement between you and the authors of the Software with respect
to the Software, and supersedes any prior understandings or agreements.

---

## 13. Acknowledgment

By using the Software you acknowledge that:

- You have read and understood this notice.
- You understand that the Software is a dual-purpose tool — a
  release-information aggregator and a general-purpose BitTorrent client —
  and that the authors neither know nor control what you choose to do with
  it.
- You are solely responsible for the legality of your use.
- You will not use the Software to infringe the rights of others.

If at any point you cannot agree to these terms, you must uninstall and
stop using the Software.
