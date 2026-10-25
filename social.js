/* Isolated synthetic demonstrations. All state is in memory for this page only. */
(function () {
  'use strict';
  const D = window.Demo;
  const E = value => D.escape(String(value == null ? '' : value));
  const draw = focusId => {
    const old = focusId && document.getElementById(focusId);
    const selection = old && typeof old.selectionStart === 'number' ? old.selectionStart : null;
    window.Demo.render();
    const next = focusId && document.getElementById(focusId);
    if (next) { next.focus(); if (selection !== null && next.type !== 'date') { try { next.setSelectionRange(selection, selection); } catch (_) {} } }
  };
  const avatar = (name, cls = 'miu-avatar') => `<span class="${cls} fallback" aria-hidden="true">${E(name === D.data.self.name ? D.data.self.letter : name.replace(/^デモ・/, '').slice(0, 1))}</span>`;
  const demoNote = '<p class="demo-local-note">紹介用の架空データです。操作はこの画面内だけで完結し、実際の連携・送信・更新は行いません。</p>';
  const safeDialog = (title, description) => window.Demo.modal(title, `<p>${E(description)}</p><p class="demo-local-note">これは紹介用のシミュレーションです。外部ページは開かず、本体には接続しません。</p>`);
  const button = (label, attr, active = false) => `<button type="button" ${attr} class="${active ? 'active' : ''}" aria-pressed="${active}">${label}</button>`;
  const option = (value, label, selected) => `<option value="${E(value)}"${value === selected ? ' selected' : ''}>${E(label)}</option>`;
  const displayDate = day => day ? day.replaceAll('-', '/') : '—';
  const rels = [['following_only', '相手からフォローなし'], ['lost', '相互から減'], ['mutual', '相互フォロー'], ['gained', '相互に増'], ['follower_only', '相手だけフォロー'], ['unknown', '未確認'], ['all', 'すべて']];
  const relations = ['following_only', 'mutual', 'follower_only', 'lost', 'unknown', 'gained', 'following_only', 'mutual', 'lost', 'follower_only', 'unknown', 'following_only', 'gained', 'mutual'];
  const people = D.data.creators.map((creator, i) => ({ ...creator, relation: relations[i], following: !['follower_only', 'unknown'].includes(relations[i]), follower: ['mutual', 'gained', 'follower_only'].includes(relations[i]), day: `2026-10-${String(24 - i % 5).padStart(2, '0')}`, active: i < 10 }));
  const events = people.map((p, i) => ({ ...p, eid: `e${i}`, change: ['lost', 'following_only', 'unknown'].includes(p.relation) ? 'removed' : 'added', direction: i % 3 === 1 ? 'followings' : 'followers', exact: ['lost', 'mutual', 'gained'].includes(p.relation) }));
  events.push({ id: 'unknown-loss', eid: 'e-unknown', name: '不明 −2', handle: '', relation: 'unknown', day: '2026-10-24', active: false, change: 'removed', direction: 'followers', exact: false, unknown: true });
  const social = { section: 'comparison', view: 'people', window: 'oldest', relationship: 'following_only', query: '', direction: 'followers', change: 'all', day: '', inspection: null, page: 1 };
  const directionName = direction => direction === 'followers' ? '相手があなたをフォロー' : 'あなたが相手をフォロー';
  const relationName = p => rels.find(x => x[0] === p.relation)?.[1] || '相手の状態を未確認';
  const relationValue = (p, key) => p.relation === 'unknown' ? '未確認' : p[key] ? '✓' : 'なし';
  const profileButton = p => `<button type="button" class="demo-link" data-profile="${p.id}">プロフィール ↗</button>`;
  function socialRows() {
    const q = social.query.trim().toLowerCase();
    let rows;
    if (social.section === 'comparison') rows = people.filter(p => social.relationship === 'all' || p.relation === social.relationship);
    else if (social.view === 'people') rows = people.filter(p => (social.direction === 'followers' ? p.follower : p.following) || p.relation === 'unknown' || !p.active);
    else rows = events.filter(p => p.direction === social.direction && (social.view !== 'investigate' || p.change === 'removed') && (social.change === 'all' || social.view === 'investigate' || p.change === social.change) && (!social.day || p.day === social.day));
    if (social.section === 'history' && social.window === 'latest') rows = rows.filter(p => p.active);
    rows = rows.filter(p => !q || `${p.name} ${p.handle}`.toLowerCase().includes(q));
    if (social.window === 'oldest') rows = [...rows].reverse();
    return rows;
  }
  function inspectionView() {
    const p = social.inspection;
    if (!p) return '';
    return `<section class="mis2-inspection" aria-live="polite"><header><b>${E(p.name)}の調査</b><button type="button" data-social-close>閉じる</button></header><p>保存履歴を使った紹介用の調査結果です。実在する人の関係は確認していません。</p>${p.unknown ? `<p>現在フォローなしを確認 1人 · 現在の関係が未確認 1人</p><p>この記録の減少：2人。下の候補数は減少人数ではありません。</p>${[people[3], people[4]].map((a, i) => `<article><b>${E(a.name)}</b><p>${i ? '現在の関係は未確認・一覧の範囲外の可能性' : '現在フォローなしを確認 2026/10/24 09:00'}</p><small>過去の確認 2026/10/20 09:00</small><div class="mis2-row-actions">${profileButton(a)}<button type="button" data-inspect="${a.id}">人物の履歴</button></div></article>`).join('')}` : `<p><b>${directionName(social.direction)}</b> · ${p.active ? '最新照合に含まれています' : '過去の保存記録です（現在の関係は未確定）'}<time>初回 2026/09/12 09:00 / 最終確認 ${displayDate(p.day)} 09:00</time></p><div><b>本人の関係確認履歴</b><ol><li><strong>保存開始時の確認</strong><span>あなたが相手をフォロー フォロー中 · 相手があなたをフォロー フォロー中</span><time>確認 2026/09/12 09:00</time></li><li><strong>前回から関係が変化</strong><span>あなたが相手をフォロー ${relationValue(p, 'following')} · 相手があなたをフォロー ${relationValue(p, 'follower')}</span><time>確認 ${displayDate(p.day)} 09:00</time></li></ol></div><ol><li><strong>${p.relation === 'lost' ? '関係終了を検知（原因不明）' : p.relation === 'unknown' ? '候補・未確定' : 'フォロー関係を確認'}</strong><span>${directionName(social.direction)} · ${p.relation === 'unknown' ? '取得範囲内の照合' : '全件照合による確認'}</span><time>${displayDate(p.day)} 09:00</time></li></ol>`}</section>`;
  }
  function socialRow(p) {
    const comparison = social.section === 'comparison', person = social.view === 'people';
    const kind = comparison ? p.relation === 'lost' ? 'removed' : 'person' : person ? 'person' : p.change;
    const label = comparison ? relationName(p) : person ? p.active ? '最新照合' : '過去の保存' : `【${p.change === 'added' ? '増' : '減'}】${directionName(p.direction)}`;
    const detail = comparison ? `あなたが相手をフォロー ${relationValue(p, 'following')} · 相手があなたをフォロー ${relationValue(p, 'follower')}` : person ? '' : p.unknown ? '公式フォロワー総数は減少しましたが、当時の取得範囲では人物を特定できませんでした。「不明分を調査」から過去の保存人物と照合できます。' : p.change === 'removed' ? p.exact ? '関係終了を検知（原因不明）' : '最新1,000人の範囲外になった可能性があり、解除は未確定です。' : directionName(p.direction);
    return `<article class="${kind}">${avatar(p.name)}<div class="mis2-body"><div><b>${E(p.name)}</b><strong>${label}</strong></div>${detail ? `<p>${detail}${!comparison && !person && !p.unknown && p.change === 'removed' ? `<em class="${p.exact ? 'confirmed' : 'candidate'}">${p.exact ? '全件照合で確認' : '候補・未確定'}</em>` : ''}</p>` : ''}<div class="mis2-row-actions">${p.unknown ? '' : profileButton(p)}${comparison ? '' : `<button type="button" data-inspect="${p.unknown ? 'unknown-loss' : p.id}">${p.unknown ? '不明分を調査' : '調査'}</button>`}</div><time>${comparison ? p.relation === 'lost' ? '相互から減を確認' : '照合' : person ? '最終確認' : '変化を検知'} ${displayDate(p.day)} 09:00${person && !comparison ? ' / 初回 2026/09/12 09:00' : ''}</time></div></article>`;
  }
  function renderSocial() {
    const rows = socialRows(), comparison = social.section === 'comparison';
    const search = `<label class="mis2-search"><span>クリエイターを探す</span><input id="demo-social-query" type="search" data-social-field="query" placeholder="名前・note ID" value="${E(social.query)}"></label>`;
    const windows = comparison ? [['oldest', '下から1,000人'], ['latest', '最新1,000人']] : [['latest', '最新1,000人'], ['oldest', '過去から1,000人'], ['all', social.view === 'people' ? '全保存人物' : '全履歴']];
    return `<div class="mis2-social-root"><div class="mis2-viewtabs">${[['comparison', '相互の照合・減を確認'], ['history', '個別の履歴']].map(([v, l]) => button(l, `data-social-section="${v}"`, social.section === v)).join('')}</div><section id="mis2-social" class="mis2"><header class="mis2-head"><div><small>${comparison ? 'FOLLOW RELATIONSHIP' : 'SOCIAL HISTORY DEMO'}</small><h2>${comparison ? 'フォローとフォロワーを照合' : 'フォロー・フォロワー'}</h2>${comparison ? '' : '<p>フォロー・フォロワーそれぞれの保存履歴。</p>'}</div></header>${demoNote}${comparison ? `<div class="mis2-window" role="group" aria-label="照合の順番">${windows.map(([v, l]) => button(l, `data-social-window="${v}"`, social.window === v)).join('')}</div><div class="mis2-comparison-status"><span>照合保存済み · 自分のフォロー 10 / 10人</span><button type="button" class="demo-link" data-social-scan>noteで照合 ↗</button></div><label class="mis2-relationship-filter"><span>表示する関係</span><select data-social-field="relationship" aria-label="表示する関係">${rels.map(([v, l]) => option(v, `${l} ${v === 'all' ? people.length : people.filter(p => p.relation === v).length}人`, social.relationship)).join('')}</select></label>${search}` : `<div class="mis2-counts"><span class="exact"><small>相手があなたをフォロー</small><b>7</b><em>完全照合 7 / 7</em><i>2026/10/24 09:00 · 今回 増2 / 減1</i></span><span class="exact"><small>あなたが相手をフォロー</small><b>10</b><em>完全照合 10 / 10</em><i>2026/10/24 09:00 · 今回の増減なし</i></span></div><div class="mis2-viewtabs">${[['people', '人物一覧'], ['changes', '【増】【減】履歴'], ['investigate', '拾えなかった減少・不明人物を再調査']].map(([v, l]) => button(l, `data-social-view="${v}"`, social.view === v)).join('')}</div><div class="mis2-peoplefilter">${[['followers', '相手があなたをフォロー'], ['followings', 'あなたが相手をフォロー']].map(([v, l]) => button(l, `data-social-direction="${v}"`, social.direction === v)).join('')}<b>${rows.length}${social.view === 'people' ? '人' : '件'}</b></div><div class="mis2-window" role="group" aria-label="照合する人物の範囲">${windows.map(([v, l]) => button(l, `data-social-window="${v}"`, social.window === v)).join('')}</div><p class="mis2-note-inline">${social.window === 'oldest' ? '取得できた一覧の下から1,000人を表示します。' : social.window === 'latest' ? '現在の最新1,000人を対象に表示します。枠外の人物や人物不明の増減は「全履歴」で確認できます。' : social.view === 'people' ? '現在の一覧から外れた人も含め、過去に保存した全人物を表示します。' : '保存している全人物の増減と、人物を特定できない総数の変化を表示します。'}</p>${social.view === 'people' ? '' : `<div class="mis2-filters">${social.view === 'changes' ? `<div class="mis2-tabs">${[['all', 'すべて'], ['added', '【増】'], ['removed', '【減】']].map(([v, l]) => button(l, `data-social-change="${v}"`, social.change === v)).join('')}</div>` : '<div class="mis2-investigate-guide"><strong>拾えなかった減少・不明人物を再調査</strong><span>人物を特定できなかった減少や、関係終了の候補を保存履歴からもう一度照合します。</span></div>'}<label><span>変化を検知した日</span><input type="date" aria-label="変化を検知した日" data-social-field="day" value="${social.day}"></label>${social.day ? '<button type="button" class="mis2-clear" data-social-clear>日付解除</button>' : ''}</div>`}${search}${inspectionView()}`}${rows.length ? `<div class="mis2-list ${comparison || social.view === 'people' ? 'people' : ''}">${rows.map(socialRow).join('')}</div>` : `<p class="mis2-empty">${comparison ? 'この条件に一致する人はいません。' : 'この条件の保存履歴はありません。'}</p>`}<p class="mis2-note">${comparison ? '「相互から減」は、以前の相互フォローと今回の相手からのフォローなしを確認した人です。' : '最新1,000人枠から外れただけではフォロワー解除扱いにしません。全件照合で関係終了が確認できても、解除・退会・ブロック等の原因は特定できません。'}</p></section></div>`;
  }
  function bindSocial(root) {
    root.querySelectorAll('[data-social-section]').forEach(el => el.onclick = () => { social.section = el.dataset.socialSection; social.window = social.section === 'comparison' ? 'oldest' : 'latest'; social.inspection = null; draw(); });
    root.querySelectorAll('[data-social-view]').forEach(el => el.onclick = () => { social.view = el.dataset.socialView; social.inspection = null; if (social.view === 'investigate') social.window = 'all'; draw(); });
    ['window', 'direction', 'change'].forEach(key => root.querySelectorAll(`[data-social-${key}]`).forEach(el => el.onclick = () => { social[key] = el.dataset['social' + key[0].toUpperCase() + key.slice(1)]; social.inspection = null; draw(); }));
    root.querySelectorAll('[data-social-field]').forEach(el => { const update = () => { social[el.dataset.socialField] = el.value; draw(el.id); }; if (el.type === 'search') el.oninput = update; else el.onchange = update; });
    root.querySelectorAll('[data-inspect]').forEach(el => el.onclick = () => { social.inspection = el.dataset.inspect === 'unknown-loss' ? events.at(-1) : people.find(p => p.id === el.dataset.inspect); draw(); });
    root.querySelector('[data-social-close]')?.addEventListener('click', () => { social.inspection = null; draw(); });
    root.querySelector('[data-social-clear]')?.addEventListener('click', () => { social.day = ''; draw(); });
    root.querySelector('[data-social-scan]')?.addEventListener('click', () => safeDialog('フォロー照合の紹介', '本体では取得できたフォロー一覧と保存済みの関係を照合します。この紹介画面では架空の照合結果だけを表示します。'));
    bindProfiles(root);
  }
  function bindProfiles(root) { root.querySelectorAll('[data-profile]').forEach(el => el.onclick = () => { const p = [D.data.self, ...people].find(p => p.id === el.dataset.profile); if (!p) return; window.Demo.modal(p.name, `${avatar(p.name)}<p>@${E(p.handle)}</p><p>紹介用クリエイターです。日々の小さな発見を文章にしています。</p><p class="demo-local-note">プロフィール表示のシミュレーションです。実在するアカウントは開きません。</p>`); }); }

  const articleSubjects = D.data.articles.map(article => article.title);
  const magazines = [
    { id: 'm0', title: '日々の小さな発見', description: '暮らしの中の気づきを集めるサンプルマガジン。', owner: 0, relation: 'owner', members: [0, 1, 2, 3], followers: 28 },
    { id: 'm1', title: 'ことばと余白のノート', description: 'エッセイや文章を楽しむ架空の共同マガジン。', owner: 2, relation: 'member', members: [2, 0, 4], followers: 17 },
    { id: 'm2', title: '週末の読書室', description: '本との出会いを持ち寄る紹介用の場所。', owner: 1, relation: 'member', members: [1, 3, 0, 5, 6], followers: 36 },
    { id: 'm3', title: '創作の練習帳', description: 'アイデアと試行錯誤を残すサンプルマガジン。', owner: 0, relation: 'owner', members: [0, 6, 7], followers: 12 }
  ].map((m, i) => {
    const owner = m.relation === 'owner' ? D.data.self : people[m.owner];
    const members = m.members.map((id, j) => m.relation === 'owner' && j === 0 ? D.data.self : people[id]);
    return { ...m, owner, members, articles: Array.from({ length: 5 }, (_, j) => ({ id: `${m.id}-a${j}`, title: articleSubjects[(i + j) % articleSubjects.length], day: `2026-10-${String(24 - j).padStart(2, '0')}`, author: members[j % members.length] })) };
  });
  const magState = { mode: 'all', query: '', open: null, searches: {} };
  const magSearch = id => magState.searches[id] || (magState.searches[id] = { query: '', day: '', searched: false, appliedQuery: '' });
  function renderMagazines() {
    const filtered = magazines.filter(m => (magState.mode === 'all' || m.relation === magState.mode) && `${m.title} ${m.owner.name}`.includes(magState.query.trim()));
    return `<section class="miu-panel mimag"><header class="miu-section-head"><div><small>MAGAZINES</small><h2>共同マガジン</h2></div><strong>${filtered.length} / ${magazines.length}誌</strong></header>${demoNote}<div class="miu-tools"><div class="miu-tabs">${[['all', 'すべて'], ['owner', '自分がオーナー'], ['member', '参加中']].map(([v, l]) => button(l, `data-mag-mode="${v}"`, magState.mode === v)).join('')}</div><input id="demo-mag-query" type="search" value="${E(magState.query)}" placeholder="マガジン名・オーナー" aria-label="マガジン名・オーナー"></div><p class="miu-source">最終同期 2026/10/24 09:00（サンプル）</p>${filtered.length ? `<div class="miu-mag-grid">${filtered.map(m => { const state = magSearch(m.id), expanded = magState.open === m.id, list = m.articles.filter(a => !state.searched || ((!state.day || a.day === state.day) && (!state.appliedQuery || `${a.title} ${a.author.name}`.includes(state.appliedQuery)))); return `<article data-magazine-key="${m.id}"><div><b>${m.title}</b><small>${m.description}</small></div><button type="button" class="mimag-owner demo-profile-button" data-profile="${m.owner.id}">${avatar(m.owner.name)}<span><small>${m.relation === 'owner' ? '自分がオーナー' : 'オーナー'}</small><b>${m.owner.name}</b></span></button><div class="miu-mag-stats"><span><b>${m.members.length}</b><small>参加人数</small></span><span><b>${m.followers}</b><small>フォロワー</small></span><span><b>${m.articles.length}</b><small>記事数</small></span></div><div class="miu-member-faces" aria-label="参加クリエイター">${m.members.map(member => `<button type="button" class="demo-profile-button" data-profile="${member.id}" title="${member.name}" aria-label="${member.name}のプロフィール">${avatar(member.name)}</button>`).join('')}</div><div class="miu-mag-actions"><button type="button" data-mag-open="${m.id}" class="${expanded ? 'active' : ''}" aria-expanded="${expanded}" aria-controls="demo-mag-panel-${m.id}">${expanded ? '検索を閉じる ↑' : '記事検索 ↓'}</button><button type="button" class="demo-link" data-mag-external="${m.id}">noteで開く ↗</button></div>${expanded ? `<div id="demo-mag-panel-${m.id}" class="miu-mag-search"><div class="miu-calendar-tools"><label><span>記事日</span><input type="date" data-mag-day="${m.id}" aria-label="記事日" value="${state.day}"></label><input data-mag-article-query="${m.id}" value="${E(state.query)}" placeholder="記事タイトル・投稿者" aria-label="記事タイトル・投稿者"><button type="button" data-mag-search="${m.id}">検索</button></div><p class="mimag-result-status" role="status">${state.searched ? '検索結果' : '最近の記事'} ${list.length}件<small>${state.searched ? 'このマガジン内の検索結果' : '日付を選ぶと自動検索'}</small></p><div class="miu-mag-articles">${list.map(a => `<button type="button" class="demo-article-card" data-mag-article="${a.id}"><time>${displayDate(a.day)}</time><b>${a.title}</b><span class="mimag-author">${avatar(a.author.name)}<small>${a.author.name}</small></span></button>`).join('')}</div>${list.length ? '' : '<p class="miu-source">条件に合う記事はありません。日付は日本時間で検索します。</p>'}</div>` : ''}</article>`; }).join('')}</div>` : '<p class="miu-empty">条件に合うマガジンはありません。</p>'}</section>`;
  }
  function bindMagazines(root) {
    root.querySelectorAll('[data-mag-mode]').forEach(el => el.onclick = () => { magState.mode = el.dataset.magMode; magState.open = null; draw(); });
    root.querySelector('#demo-mag-query').oninput = e => { magState.query = e.target.value; magState.open = null; draw('demo-mag-query'); };
    root.querySelectorAll('[data-mag-open]').forEach(el => el.onclick = () => { magState.open = magState.open === el.dataset.magOpen ? null : el.dataset.magOpen; draw(); });
    const search = id => { const state = magSearch(id); state.searched = true; state.appliedQuery = state.query.trim(); draw(); };
    root.querySelectorAll('[data-mag-day]').forEach(el => el.onchange = () => { magSearch(el.dataset.magDay).day = el.value; search(el.dataset.magDay); });
    root.querySelectorAll('[data-mag-article-query]').forEach(el => { el.oninput = () => { magSearch(el.dataset.magArticleQuery).query = el.value; }; el.onkeydown = e => { if (e.key === 'Enter') search(el.dataset.magArticleQuery); }; });
    root.querySelectorAll('[data-mag-search]').forEach(el => el.onclick = () => search(el.dataset.magSearch));
    root.querySelectorAll('[data-mag-external]').forEach(el => el.onclick = () => safeDialog('マガジンを開く', '本体では選んだ共同マガジンを開けます。この紹介画面では外部に移動しません。'));
    root.querySelectorAll('[data-mag-article]').forEach(el => el.onclick = () => { const a = magazines.flatMap(m => m.articles).find(a => a.id === el.dataset.magArticle); safeDialog(a.title, `${a.author.name} · ${displayDate(a.day)}。共同マガジン内で見つけた記事を開く操作のシミュレーションです。`); });
    bindProfiles(root);
  }

  const peers = [{ id: 1, count: 6, rooms: 1 }, { id: 2, count: 54, rooms: 2 }, { id: 4, count: 4, rooms: 1 }];
  const dmState = { selected: null, page: 1, historyOpen: false, settingsOpen: false };
  const dmTexts = ['新しい記事を読みました。日常の視点が素敵ですね。', '読んでくださってありがとうございます。小さな発見を残してみました。', '次の共同マガジンも楽しみにしています。', '週末にゆっくり書き進める予定です。', '写真と言葉の組み合わせも印象的でした。', '温かな感想をありがとうございます。'];
  function dmMessages(peer) {
    return Array.from({ length: peer.count }, (_, i) => {
      const stamp = Date.parse(i < 50 ? '2026-10-24T09:00:00+09:00' : '2026-10-12T09:00:00+09:00') - (i < 50 ? i : i - 50) * 31 * 60000;
      const japanTime = new Date(stamp + 9 * 3600000).toISOString();
      return { id: i, direction: i % 2 ? 'outbound' : 'inbound', body: dmTexts[i % dmTexts.length], day: japanTime.slice(0, 10).replaceAll('-', '/'), time: japanTime.slice(11, 16), attachment: i === 2 };
    });
  }
  function renderDm() {
    const peer = peers.find(p => p.id === dmState.selected), messages = peer ? dmMessages(peer).slice((dmState.page - 1) * 50, dmState.page * 50).reverse() : [];
    return `<section id="midm" class="midm"><header class="midm-head"><div><small>PRIVATE DIRECT MESSAGES</small><h2>DM</h2><p>本体では、通常のnote DM画面を使いながら各ルームを同期し、相手ごとにまとめます。</p></div></header>${demoNote}<div class="midm-control"><div class="midm-control-state"><strong class="ok">✓ 表示例：DM連携済み</strong><span><b>${peers.length}</b>人</span><span><b>${peers.reduce((n, p) => n + p.count, 0)}</b>件</span><span class="last">本文保存 2026/10/24 09:00（サンプル）</span></div><div class="midm-control-main"><button type="button" class="demo-dm-open" data-dm-action="open">noteのDMを開く ↗</button></div><details data-dm-settings${dmState.settingsOpen ? ' open' : ''}><summary><span>⚙ 設定・状態</span><b>開く / 閉じる ▾</b></summary><div class="midm-control-detail"><span class="midm-version-state">DM同期（紹介用の状態表示）</span><button type="button" data-dm-action="pair">DM連携を再設定</button><button type="button" data-dm-action="refresh">保存先を再確認</button></div></details></div><p class="midm-read-status" role="status"><b>✓ 表示例：全会話保存完了（新着監視は行いません）</b><span>完了 3 / 3人 · 本文保存 64件（サンプル）</span></p><details class="midm-history-panel" data-dm-history${dmState.historyOpen ? ' open' : ''}><summary><span>DM履歴</span><b>3人</b><small>タップして開く</small></summary><div class="midm-layout ${peer ? 'is-person' : 'is-list'}">${peer ? `<div class="midm-person-view"><button type="button" class="midm-back-list" data-dm-back>← DM履歴一覧</button><div class="midm-messages"><div class="midm-room-head">${avatar(people[peer.id].name, 'midm-avatar')}<div><b>${people[peer.id].name}</b>${profileButton(people[peer.id])}<small>${peer.rooms > 1 ? '2ルームを1人分として統合' : 'この人とのDM履歴'}</small></div></div>${messages.map(m => `<article class="midm-message ${m.direction}"><small>${m.direction === 'outbound' ? 'あなた' : people[peer.id].name} · ${m.day} ${m.time}</small><p>${m.body}</p>${m.attachment ? '<button type="button" class="demo-link" data-dm-action="attachment">参考メモ（サンプル） ↗</button>' : ''}</article>`).join('')}${peer.count > 50 ? `<div class="midm-message-pages"><button type="button" data-dm-page="${dmState.page - 1}"${dmState.page <= 1 ? ' disabled' : ''}>新しいDM</button><span>${dmState.page} / ${Math.ceil(peer.count / 50)}ページ · 全${peer.count}件</span><button type="button" data-dm-page="${dmState.page + 1}"${dmState.page >= Math.ceil(peer.count / 50) ? ' disabled' : ''}>過去のDM</button></div>` : ''}</div></div>` : `<aside class="midm-threads">${peers.map(p => `<button type="button" data-dm-person="${p.id}">${avatar(people[p.id].name, 'midm-avatar')}<span><b>${people[p.id].name}</b><small>${p.rooms > 1 ? '2ルーム統合 · ' : ''}2026/10/24 09:00</small></span></button>`).join('')}</aside>`}</div></details></section>`;
  }
  function bindDm(root) {
    root.querySelector('[data-dm-history]').ontoggle = e => { dmState.historyOpen = e.target.open; };
    root.querySelector('[data-dm-settings]').ontoggle = e => { dmState.settingsOpen = e.target.open; };
    root.querySelectorAll('[data-dm-person]').forEach(el => el.onclick = () => { dmState.selected = Number(el.dataset.dmPerson); dmState.page = 1; dmState.historyOpen = true; draw(); });
    root.querySelector('[data-dm-back]')?.addEventListener('click', () => { dmState.selected = null; dmState.page = 1; draw(); });
    root.querySelectorAll('[data-dm-page]').forEach(el => el.onclick = () => { dmState.page = Number(el.dataset.dmPage); draw(); root.querySelector('.midm-room-head')?.scrollIntoView({ block: 'nearest' }); });
    root.querySelectorAll('[data-dm-action]').forEach(el => el.onclick = () => { const type = el.dataset.dmAction; const map = { open: ['noteのDMを開く', '本体では通常のDM画面を使います。ここでは相手一覧と会話の閲覧だけを体験できます。'], pair: ['DM連携を再設定', '本体では同期ツールとの連携状態を確認・再設定できます。この紹介サイトから認証やインストールは行いません。'], refresh: ['保存先を再確認', '架空の保存済みDM 64件を表示しています。外部の保存先に問い合わせることはありません。'], attachment: ['添付ファイルの表示', '実際の添付ファイルではありません。会話に添付された資料を開く機能の紹介です。'] }; safeDialog(...map[type]); });
    bindProfiles(root);
  }

  const archive = Array.from({ length: 46 }, (_, i) => { const month = i < 18 ? '10' : i < 34 ? '09' : '08', day = String(24 - (i % 18)).padStart(2, '0'); return { id: `archive-${i}`, title: `${articleSubjects[i % articleSubjects.length]}${i < 6 ? '' : ` ${Math.floor(i / 6) + 1}`}`, day: `2026-${month}-${day}`, likes: 18 + i * 3 % 71, comments: i % 8, thumb: i % 6 }; });
  const archiveState = { query: '', day: '', month: 'all', sort: 'newest', limit: 40 };
  function renderArticles() {
    const rows = archive.filter(a => (!archiveState.query || a.title.toLowerCase().includes(archiveState.query.toLowerCase())) && (!archiveState.day || a.day === archiveState.day) && (archiveState.month === 'all' || a.day.startsWith(archiveState.month))).sort((a, b) => archiveState.sort === 'newest' ? b.day.localeCompare(a.day) : a.day.localeCompare(b.day));
    return `<section class="miu-panel demo-archive"><header class="miu-section-head"><div><small>ARTICLE ARCHIVE</small><h2>自分の記事・過去アーカイブ</h2></div><strong>${rows.length}件</strong></header>${demoNote}<div class="miu-tools"><input type="date" data-archive-field="day" value="${archiveState.day}" aria-label="記事の日付"><input id="demo-archive-query" type="search" data-archive-field="query" value="${E(archiveState.query)}" placeholder="記事タイトルを検索" aria-label="記事タイトルを検索"><select data-archive-field="month" aria-label="記事の月">${[['all', '全期間'], ['2026-10', '2026年10月'], ['2026-09', '2026年09月'], ['2026-08', '2026年08月']].map(([v, l]) => option(v, l, archiveState.month)).join('')}</select><select data-archive-field="sort" aria-label="記事の並び順">${[['newest', '新しい順'], ['oldest', '古い順']].map(([v, l]) => option(v, l, archiveState.sort)).join('')}</select></div><div class="miu-self-article-grid">${rows.slice(0, archiveState.limit).map(a => `<button type="button" class="demo-self-article" data-archive-open="${a.id}"><span class="miu-self-thumb demo-thumb demo-thumb-${a.thumb}" aria-hidden="true"><span>${['ESSAY', 'WALK', 'NOTE', 'SEASON', 'BOOKS', 'LIFE'][a.thumb]}</span></span><div><time>${displayDate(a.day)}</time><b>${a.title}</b><span>公式 ♡ ${a.likes}　💬 ${a.comments}</span></div></button>`).join('')}</div>${!rows.length ? '<p class="miu-empty">条件に合う記事はありません。</p>' : ''}${archiveState.limit < rows.length ? `<button type="button" class="miu-more" data-archive-more>さらに40件表示（残り ${rows.length - archiveState.limit}件）</button>` : ''}</section>`;
  }
  function bindArticles(root) {
    root.querySelectorAll('[data-archive-field]').forEach(el => { const update = () => { archiveState[el.dataset.archiveField] = el.value; archiveState.limit = 40; draw(el.id); }; if (el.type === 'search') el.oninput = update; else el.onchange = update; });
    root.querySelector('[data-archive-more]')?.addEventListener('click', () => { archiveState.limit += 40; draw(); });
    root.querySelectorAll('[data-archive-open]').forEach(el => el.onclick = () => { const a = archive.find(a => a.id === el.dataset.archiveOpen); window.Demo.modal(a.title, `<p class="miu-source">${displayDate(a.day)} · サンプル記事</p><p>いつもの暮らしにも、まだ気づいていない小さな景色があります。これは記事を開く体験のために用意した架空の文章です。</p><p>自分の記事を日付やタイトルで見つけ、過去の投稿を振り返る流れを試せます。</p><p class="demo-local-note">外部記事には移動しません。掲載された文章と数値はすべて紹介用です。</p>`); });
  }
  window.DemoViews = window.DemoViews || {};
  Object.assign(window.DemoViews, {
    social: { render: renderSocial, bind: bindSocial, guide: { title: 'フォロー関係を見える化', body: '相互の照合と、人物ごとの増減履歴を切り替えられます。未確認の情報を解除と決めつけない表示も再現しています。', steps: ['「表示する関係」で相互・相手からフォローなし・相互から減などを切り替える', '「個別の履歴」で人物・増減・再調査を開き、範囲や日付を絞る', '「調査」「不明分を調査」で架空の確認履歴や候補を見る'] } },
    magazines: { render: renderMagazines, bind: bindMagazines, guide: { title: '共同マガジンを横断して探す', body: 'オーナー・参加状況、人数、フォロワー、記事数を確認し、その場で記事を検索できます。', steps: ['「自分がオーナー」「参加中」と名前検索で絞り込む', '「記事検索 ↓」を開き、記事日・タイトル・投稿者で検索する', '架空の記事やプロフィールを開き、検索を閉じて別のマガジンを見る'] } },
    dm: { render: renderDm, bind: bindDm, guide: { title: 'DMを相手ごとにまとめて振り返る', body: '相手一覧から一人分の会話を表示する現在の構造です。この画面は閲覧用で、送信フォームはありません。', steps: ['「DM履歴」を開いて架空の相手を選ぶ', '「デモ・なぎ」で2ルーム統合と過去のDMへのページ切替を試す', '「設定・状態」から連携・保存先確認の説明を見る。実際の連携は行わない'] } },
    articles: { render: renderArticles, bind: bindArticles, guide: { title: '過去の記事をすばやく見つける', body: '自分の記事を日付、月、タイトルで絞り、新しい順・古い順で振り返れます。', steps: ['日付・記事タイトル・月の条件を変える', '新しい順と古い順を切り替える', '「さらに40件表示」で残りの記事を出し、カードからサンプル記事を見る'] } }
  });
})();