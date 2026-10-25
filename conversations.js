/* Standalone, synthetic UI only. No service integration or persistent state. */
(() => {
  'use strict';
  const D = window.Demo;
  const V = window.DemoViews = window.DemoViews || {};
  const e = value => D.escape(String(value == null ? '' : value));
  const fmt = value => new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  const dayOf = value => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date(value));
  const syntheticNotice = '<p class="conversation-demo-note">体験用の架空データです。変更はこの紹介デモ内だけで、送信・取得・サーバー保存は行いません。</p>';
  const avatar = (name, cls) => `<span class="${cls} fallback" aria-hidden="true">${e(name.replace('デモ・', '').slice(0, 1))}</span>`;
  const link = (text, action, value = '', cls = '') => `<a role="button" tabindex="0" class="${cls}" data-c-action="${action}" data-c-value="${e(value)}">${e(text)}</a>`;
  const demoExplanation = (title, body) => D.modal(title, `<p>${e(body)}</p><p class="conversation-demo-note">紹介用のローカル表示です。外部サイトへの移動や、本体との通信はありません。</p>`);
  const people = D.data.creators.slice(0, 6);
  const articleTitles = D.data.articles.map(article => article.title);
  const bodies = ['読みながら、自分の小さな発見も思い出しました。次の投稿も楽しみにしています。', '無理なく続ける工夫が参考になりました。私も朝の時間から試してみます。', '言葉にして残すと、何気ない一日にも新しい見え方が生まれますね。', '最後の一節が特に好きです。素敵な視点をありがとうございます。', '写真と言葉の組み合わせがとても心地よく、ゆっくり読ませていただきました。', '続けることより、また始めることを大切にしてもいいのですね。'];
  const favoriteState = D.state.favorites;
  const favorites = favoriteState.ids;
  const readArticles = new Set(['sample-a-1', 'sample-b-2']);
  const favoriteArticles = person => articleTitles.slice(0, 4).map((title, i) => ({ id: `${person.id}-${i}`, title: `${title} ${i ? '・記録 ' + (i + 1) : ''}`, body: bodies[(i + D.data.creators.indexOf(person)) % bodies.length], date: `2026-10-${String(24 - i).padStart(2, '0')}T${String(9 + i).padStart(2, '0')}:00:00+09:00`, likes: 18 + i * 9, comments: i + 2 }));
  const commentState = { status: 'all', day: '', article: '', draft: '', query: '', limit: 120, opened: new Set(), collectionMessage: '' };
  const threadStatuses = ['unreplied', 'followup_pending', 'heart_closed', 'replied'];
  const threads = Array.from({ length: 72 }, (_, i) => {
    const person = people[[0, 1, 2, 0, 3, 1, 4, 0, 2, 5, 0, 1][i % 12]], status = threadStatuses[(i + Math.floor(i / 12)) % 4];
    const article = D.data.articles[Math.floor(i / people.length) % D.data.articles.length];
    const sampleDay = `2026-10-${String(24 - Math.floor(i / 8)).padStart(2, '0')}`;
    const date = `${sampleDay < article.date ? article.date : sampleDay}T${String(20 - (i % 8)).padStart(2, '0')}:20:00+09:00`;
    const body = bodies[i % bodies.length];
    const messages = [{ name: person.name, body, self: false, at: date, root: true, heart: status === 'heart_closed' }];
    if (status === 'followup_pending' || status === 'replied') messages.push({ name: 'あなた', body: '読んでくださってありがとうございます。こうして感想を聞けることが励みになります。', self: true, at: new Date(new Date(date).getTime() + 600000).toISOString(), root: false });
    if (status === 'followup_pending') messages.push({ name: person.name, body: 'こちらこそ、ありがとうございます！ 次の記録も楽しみにしています。', self: false, at: new Date(new Date(date).getTime() + 1200000).toISOString(), root: false });
    return { id: `thread-${i}`, person, status, article: article.id, title: article.title, body, date, messages, lastHeart: i % 8 === 3 };
  });
  D.data.commentThreads = threads;
  const events = threads.flatMap(t => t.messages.map((m, j) => ({ ...m, id: `${t.id}-${j}`, thread: t }))).sort((a, b) => new Date(b.at) - new Date(a.at));
  const statusLabels = { unreplied: '未返信', followup_pending: '相手の返信で停止', heart_closed: 'あなたの♡で終了', replied: '自分の返信で終了' };
  const commentTabs = [['all', 'すべて（全コメント）'], ['pending', '要対応'], ['unreplied', '未返信'], ['followup_pending', '相手返信'], ['heart_closed', 'あなたの♡で終了'], ['replied', '自分返信']];
  function commentPerson(name, self = false) {
    return `<span class="micf-person ${self ? 'mine' : ''}">${avatar(name, 'micf-avatar')}<span><b>${e(name)}</b>${link('プロフィール ↗', 'profile', name)}</span></span>`;
  }
  const matchesText = (values, query) => !query.trim() || values.join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  function commentRows() {
    const s = commentState;
    if (s.status === 'all') return events.filter(m => (!s.day || dayOf(m.at) === s.day) && (!s.article || m.thread.article === s.article) && matchesText([m.name, m.body, m.thread.title], s.query));
    return threads.filter(t => (s.status === 'pending' ? ['unreplied', 'followup_pending'].includes(t.status) : s.status === t.status) && (!s.day || t.messages.some(m => dayOf(m.at) === s.day)) && (!s.article || t.article === s.article) && matchesText([t.person.name, t.title, ...t.messages.map(m => m.body)], s.query));
  }
  function renderComments() {
    const s = commentState, rows = commentRows(), dayArticles = [...new Set(events.filter(m => dayOf(m.at) === s.day).map(m => m.thread.article))];
    return `<section class="micf"><header class="micf-head"><div><small>COMMENT HISTORY</small><h2>コメント・返信履歴</h2><p>${s.status === 'all' ? '保存済みの全コメント・全返信を、会話数ではなく1件ずつ全部表示します。' : '対応状況ごとの会話一覧です。「自分の返信で終了」は最後の返信への相手本人の♡も照合します。'}</p></div><strong>${rows.length}件</strong></header>
      ${syntheticNotice}<div class="micf-load-state done"><b>体験データを表示</b><span>${events.length}件の架空コメント</span></div>
      <div class="micf-tabs" aria-label="コメントの対応状況">${commentTabs.map(([id, name]) => `<button type="button" data-c-action="comment-tab" data-c-value="${id}" class="${s.status === id ? 'active' : ''}" aria-pressed="${s.status === id}">${name}</button>`).join('')}</div>
      <div class="micf-tools"><label><span>コメント日</span><input type="date" data-c-input="comment-day" aria-label="コメント日" value="${e(s.day)}"></label><select data-c-input="comment-article" aria-label="対象記事" ${s.day ? '' : 'disabled'}><option value="">${s.day ? `この日の記事すべて (${dayArticles.length})` : '日付を選択すると記事一覧'}</option>${dayArticles.map(id => `<option value="${id}" ${s.article === id ? 'selected' : ''}>${e(D.data.articles.find(article => article.id === id)?.title || '架空の記事')}（${events.filter(m => dayOf(m.at) === s.day && m.thread.article === id).length}件）</option>`).join('')}</select><input data-c-input="comment-query" value="${e(s.draft)}" placeholder="名前・記事・コメント本文" aria-label="コメント履歴を検索"><button type="button" data-c-action="comment-search">検索</button>${s.day ? '<button type="button" data-c-action="comment-clear-day">日付解除</button>' : ''}<button type="button" data-c-action="collect-comments">noteからコメントを取得</button></div>
      ${s.collectionMessage ? `<div class="micf-load-state" role="status"><b>${e(s.collectionMessage)}</b></div>` : ''}
      ${rows.length ? s.status === 'all' ? `<div class="micf-event-list">${rows.slice(0, s.limit).map(m => `<article class="${m.self ? 'mine' : ''}">${commentPerson(m.name, m.self)}<span class="micf-event-kind">${m.self ? (m.root ? 'あなたのコメント' : 'あなたの返信') : (m.root ? 'コメント' : '返信')}</span><p>${e(m.body)}</p>${link(m.thread.title + ' ↗', 'article', m.thread.title)}<time>${fmt(m.at)}</time>${m.heart ? '<small class="micf-event-heart">♥ あなたの♡</small>' : ''}</article>`).join('')}</div>` : `<div class="micf-thread-list">${rows.slice(0, s.limit).map(t => `<details data-c-detail="comment-${t.id}" ${s.opened.has(t.id) ? 'open' : ''}><summary>${commentPerson(t.person.name)}<span class="micf-state ${t.status}">${statusLabels[t.status]}</span><p>${e(t.body)}</p>${link(t.title, 'article', t.title)}<time>${fmt(t.messages[t.messages.length - 1].at)}</time>${t.status === 'replied' ? `<div class="micf-heart ${t.lastHeart ? 'yes' : 'no'}">${t.lastHeart ? '♥' : '♡'} 最終返信に${e(t.person.name)}さんの♡${t.lastHeart ? 'あり' : 'なし'} <small>（架空の状態）</small></div>` : ''}</summary><div class="micf-thread">${t.messages.map(m => `<article class="${m.self ? 'mine' : ''}"><div><b>${e(m.name)}</b><small>${fmt(m.at)}</small></div><p>${e(m.body)}</p></article>`).join('')}</div></details>`).join('')}</div>` : '<p class="micf-empty">この条件のコメント履歴はありません。</p>'}
      ${rows.length > s.limit ? `<div class="micf-more"><b>${s.limit} / ${rows.length}件を表示</b><span>続きを表示して全履歴を確認できます</span><button type="button" data-c-action="comment-more">続きを表示</button></div>` : ''}</section>`;
  }
  const categories = [['all', 'すべて'], ['creator_article_posted', '記事投稿・更新'], ['badge', 'バッジ獲得'], ['purchase_message', '購入記事のメッセージ'], ['my_article_magazine_added', '自分の記事追加'], ['comment_like', 'コメント♡'], ['reply_self', '自分の記事返信'], ['reply_other', '相手の記事返信'], ['reply_unknown', '返信先確認待ち'], ['magazine_follow', 'マガジンフォロー'], ['magazine_article_added', 'マガジン記事追加'], ['magazine_join', 'マガジン参加'], ['membership_board', 'メンシプ掲示板'], ['membership_board_reply', '掲示板返信'], ['membership_reaction_self', '自分のメンシプ反応'], ['membership_reaction_joined', '参加中のメンシプ反応'], ['membership_reaction_unknown', 'メンシプ所有者確認待ち'], ['membership_article_added', 'メンシプ記事追加'], ['membership_article_updated', 'メンシプ記事更新'], ['membership_magazine_added', 'メンシプ特典マガジン追加'], ['membership_started', 'メンシプ開始'], ['membership_plan', 'プラン追加'], ['membership_join', 'メンシプ参加'], ['question_box_started', '質問箱開始'], ['store_started', 'お店をはじめました'], ['question_answer', '質問への回答'], ['purchased_article_updated', '購入した記事の更新'], ['purchase', '購入'], ['tip', 'チップ・サポート'], ['buzz', '話題'], ['rating', '高評価'], ['points', 'ポイント'], ['quote', '引用・紹介'], ['image_used', '画像の使用'], ['other', 'その他・未分類']];
  const categoryLabel = Object.fromEntries(categories);
  const notificationKinds = ['reply_self', 'comment_like', 'my_article_magazine_added', 'creator_article_posted', 'reply_other', 'membership_board', 'magazine_article_added', 'badge', 'image_used', 'quote', 'membership_board_reply', 'store_started', 'other'];
  const notificationDays = ['2026-10-24', '2026-10-23', '2026-10-17', '2026-09-28', '2026-08-15', '2026-07-01'];
  const notifications = Array.from({ length: 108 }, (_, i) => {
    const kind = notificationKinds[i % notificationKinds.length], person = people[i % people.length], title = articleTitles[i % articleTitles.length];
    const detail = { reply_self: 'あなたの記事のコメントに返信しました。', comment_like: 'あなたのコメントにスキしました。', my_article_magazine_added: 'あなたの記事をマガジンに追加しました。', creator_article_posted: '新しい記事を投稿しました。', reply_other: '相手の記事であなたのコメントに返信しました。', membership_board: 'メンバーシップの掲示板に投稿しました。', magazine_article_added: 'マガジンに記事が追加されました。', badge: '継続投稿のバッジを獲得しました。', image_used: 'あなたの画像が記事で使われました。', quote: 'あなたの記事が紹介されました。', membership_board_reply: '掲示板の投稿に返信しました。', store_started: 'お店をはじめました。', other: '本文が不足しているため、通知の種別は確認できていません。' }[kind];
    return { id: `notice-${i}`, kind, person, title, detail, date: `${notificationDays[Math.floor(i / 18)]}T${String(23 - (i % 18)).padStart(2, '0')}:15:00+09:00`, confirmed: i % 5 === 4, conversation: ['reply_self', 'reply_other', 'comment_like', 'membership_board', 'membership_board_reply'].includes(kind) };
  });
  // Analytics reads this same synthetic dataset; handling remains owned by this view.
  D.data.notifications = notifications;
  const notificationState = { kind: 'all', handling: 'all', day: '', page: 1, details: new Set(), archiveOpen: false, permissionOpen: false, previewEnabled: false, archiveItems: new Set(), accuracyOpen: false, repairMessage: '' };
  function notificationRows(ignoreHandling = false) {
    const s = notificationState;
    return notifications.filter(n => (s.kind === 'all' || s.kind === n.kind) && (!s.day || dayOf(n.date) === s.day) && (ignoreHandling || s.handling === 'all' || (s.handling === 'completed' ? n.confirmed : !n.confirmed)));
  }
  function outgoingArchive() {
    const s = notificationState;
    return `<details class="mioc" data-c-detail="archive" ${s.archiveOpen ? 'open' : ''}><summary>自分のコメント履歴 <span>送信した本文・会話</span></summary><div class="mioc-content"><p>一度保存できた自分の本文は、noteで削除されても履歴として残ります。記事URLを毎回入力する必要はありません。</p><p class="conversation-demo-note">以下は保存機能の説明と架空の履歴です。実際のコメントは取得していません。</p><details class="mioc-permission" data-c-detail="permission" ${s.permissionOpen ? 'open' : ''}><summary>自分の投稿を保存する設定</summary><p>初期状態はオフです。同意したReader搭載ブラウザで、noteへの投稿に成功した自分のコメント本文、アカウント・記事・コメント・親コメントのID、投稿日時を、本人用の非公開INSIGHT保存先へ送る機能です。</p><p>下書き・投稿失敗・旧形式のコメント欄・note公式アプリからの投稿は対象外です。対応する新形式のコメント欄だけを保存します。過去の未保存コメントは復元できません。連携していない端末の投稿も自動保存されません。</p><p class="mioc-permission-status"><b>実際の保存連携：オフ（この紹介サイトでは変更できません）</b></p><p>実際の初回設定は2操作です。データの送信・保存に同意した後、Readerを入れた同じブラウザのnote上で有効化を確認します。</p><button type="button" data-c-action="consent-explain">「同意してnoteへ進む」の説明</button><button type="button" data-c-action="consent-preview" role="switch" aria-checked="${s.previewEnabled}">画面内の設定表示を試す：${s.previewEnabled ? 'オン' : 'オフ'}</button><p class="conversation-demo-note" role="status">${s.previewEnabled ? '表示だけをオンにした例です。実際の同意・端末登録・送信・保存は一切行われていません。' : '体験用スイッチはオフです。切り替えても実際の保存連携は有効になりません。'}</p></details><div class="mioc-toolbar"><button type="button" data-c-action="archive-refresh">履歴を更新</button><small>架空の保存履歴 2件</small></div><div class="mioc-list">${[0, 1].map(i => `<details class="mioc-entry" data-c-detail="archive-${i}" ${s.archiveItems.has(String(i)) ? 'open' : ''}><summary><span>${e(bodies[i])}</span><small>2026/10/${24 - i} 09:30 · ${i ? '返信' : 'コメント'}</small></summary><ol class="mioc-conversation" aria-label="架空の保存したコメントの会話"><li class="mioc-message self"><small>自分 · 2026/10/${24 - i} 09:30</small><p>${e(bodies[i])}</p></li>${i ? `<li class="mioc-message other"><small>${e(people[i].name)} · 2026/10/23 10:00</small><p>読んでくださってありがとうございます。うれしい感想をいただきました。</p></li>` : ''}</ol><p class="mioc-reply-state">返信の取得状況は未確認。実際の機能では、保存できた会話だけを表示します。</p>${link('このコメントをnoteで開く ↗（説明）', 'archive-link')}<div class="mioc-entry-actions"><button type="button" data-c-action="archive-refresh">保存した会話を更新</button></div></details>`).join('')}</div></div></details>`;
  }
  function notificationPager(total) {
    const pages = Math.ceil(total / 100), s = notificationState;
    if (pages <= 1) return '';
    return `<nav class="minf-pager" aria-label="本人通知のページ送り"><button type="button" data-c-action="notice-page" data-c-value="${s.page - 1}" ${s.page <= 1 ? 'disabled' : ''}>← 前</button><label><span>ページ</span><select data-c-input="notice-page" aria-label="通知のページ">${Array.from({ length: pages }, (_, i) => `<option value="${i + 1}" ${s.page === i + 1 ? 'selected' : ''}>${i + 1} / ${pages}</option>`).join('')}</select></label><button type="button" data-c-action="notice-page" data-c-value="${s.page + 1}" ${s.page >= pages ? 'disabled' : ''}>次 →</button></nav>`;
  }
  function renderNotifications() {
    const s = notificationState, allRows = notificationRows(true), rows = notificationRows();
    s.page = Math.max(1, Math.min(s.page, Math.ceil(rows.length / 100) || 1));
    const counts = { all: allRows.length, pending: allRows.filter(n => !n.confirmed).length, completed: allRows.filter(n => n.confirmed).length };
    const categoryCounts = Object.fromEntries(categories.map(([kind]) => [kind, notifications.filter(n => (kind === 'all' || n.kind === kind) && (!s.day || dayOf(n.date) === s.day)).length]));
    return `<section id="minf-notifications" class="minf"><header class="minf-head"><div><small>PRIVATE NOTIFICATION HISTORY</small><h2>本人通知</h2><p>保存済み通知を即表示。分類・日付・精度確認は1パネルにまとめています。</p></div><div class="minf-actions">${link('🔔 note通知', 'note-notifications', '', 'minf-note')}</div></header>${syntheticNotice}<div class="minf-quick" role="status"><div class="minf-quick-save"><span>架空データの日時</span><strong>2026/10/24 23:15</strong><i>通信なし</i></div><div class="minf-quick-progress"><b>表示例 ${notifications.length}件</b></div></div><nav class="minf-handling-tabs" aria-label="本人通知の対応状況">${[['all', 'すべて'], ['pending', '未対応'], ['completed', '対応済み']].map(([id, name]) => `<button type="button" data-c-action="notice-handling" data-c-value="${id}" class="${s.handling === id ? 'active' : ''}" aria-pressed="${s.handling === id}">${name}<small>${counts[id]}</small></button>`).join('')}${link('★ お気に入り', 'favorite-view')}</nav><div class="minf-filter-panel" aria-label="本人通知の表示条件"><label><span>分類</span><select data-c-input="notice-kind" aria-label="通知の分類">${categories.map(([id, name]) => `<option value="${id}" ${s.kind === id ? 'selected' : ''}>${name} (${categoryCounts[id]})</option>`).join('')}</select></label><label><span>日付</span><input type="date" data-c-input="notice-day" aria-label="通知の日付" value="${e(s.day)}"></label>${s.day ? '<button type="button" data-c-action="notice-clear-day">全期間</button>' : '<span class="minf-filter-total">全期間</span>'}</div>${outgoingArchive()}<details class="minf-detail" data-c-detail="accuracy" ${s.accuracyOpen ? 'open' : ''}><summary>詳細・精度・再分類 <span>開く / 閉じる ▾</span></summary><div class="minf-detail-body"><div class="minf-reader-server"><b>説明用の数値（実際のサーバー状態ではありません）</b><span>架空データ</span></div><dl>${[['端末 最終読取', '未接続'], ['今回 読取', '0件'], ['今回 保存確認', '0件'], ['サーバー 受信', '通信なし'], ['サーバー 保存確認', '通信なし'], ['画面確認', '体験画面']].map(([name, value]) => `<div><dt>${name}</dt><dd>${value}</dd></div>`).join('')}</dl><p>実際の機能では、取得条件やnote側表示により欠落・重複・時刻ずれが起こる場合があります。重要な確認はnote本体を優先してください。この紹介サイトからnoteには移動しません。</p><button type="button" data-c-action="notice-reclassify">未分類を再分類</button>${s.repairMessage ? `<p role="status">${e(s.repairMessage)}</p>` : ''}<p class="minf-unresolved">本文不足の例は推測で分類しません。「未処理0件」と「未解決0件」は異なります。</p></div></details>${notificationPager(rows.length)}${rows.length ? `<div class="minf-list">${rows.slice((s.page - 1) * 100, s.page * 100).map(n => `<article class="type-${n.kind}${n.confirmed ? ' is-handled' : ''}" data-person-id="${n.person.id}" data-notice-id="${n.id}" ${n.conversation ? 'data-comment-context-native="true"' : ''}><div class="minf-meta"><span>${n.kind === 'other' ? '本文不足・種別不明' : categoryLabel[n.kind]}</span>${n.kind.startsWith('reply_') ? `<b>${n.kind === 'reply_self' ? '自分の記事' : '相手の記事'}</b>` : ''}<time>${fmt(n.date)}</time></div><div class="minf-who">${avatar(n.person.name, 'minf-avatar')}<div>${link(n.person.name, 'profile', n.person.name, 'minf-actor')}</div></div><div class="minf-row-actions"><button type="button" class="minf-star ${favorites.has(n.person.id) ? 'active' : ''}" data-c-action="notice-favorite" data-c-value="${n.person.id}" aria-pressed="${favorites.has(n.person.id)}" aria-label="${favorites.has(n.person.id) ? 'お気に入り解除' : 'お気に入り登録'}">${favorites.has(n.person.id) ? '★' : '☆'}</button><div class="minf-completion"><button type="button" data-c-action="notice-complete" data-c-value="${n.id}" aria-pressed="${n.confirmed}" aria-label="${n.confirmed ? '未対応に戻す' : '対応済みにする'}">${n.confirmed ? '✓ 対応済み' : '対応済み'}</button></div></div>${link('', 'article', n.title, 'minf-main').replace('></a>', `><strong>${e(n.detail)}</strong><span>${e(n.title)}</span><small>${e(n.detail)}</small></a>`)}${n.kind === 'my_article_magazine_added' ? `<div class="minf-return-links">${link('追加された自分の記事 ↗', 'article', n.title)}${link('追加先マガジン ↗', 'magazine', 'デモ・小さな発見集')}</div>` : ''}${n.conversation ? `<details class="minf-comment-context" data-c-detail="notice-${n.id}" ${s.details.has(n.id) ? 'open' : ''}><summary>${n.kind === 'comment_like' ? 'スキされたコメント本文' : n.kind.startsWith('membership_board') ? '掲示板本文' : '返信本文・会話'}</summary><div><ol class="minf-conversation" aria-label="架空の保存したコメントの会話"><li class="minf-message self"><small>自分 · ${fmt(n.date)}</small><p>${e(bodies[people.indexOf(n.person)])}</p></li>${n.kind !== 'comment_like' ? `<li class="minf-message other"><small>${e(n.person.name)}</small><p>ありがとうございます。お互いの発見を持ち寄れる場所にしていきたいですね。</p></li>` : ''}</ol><small>架空の会話です。実際の機能では、取得・保存できた範囲の履歴が表示されます。</small></div></details>` : ''}${link('対象を開く ↗（画面内プレビュー）', 'article', n.title, 'minf-target')}</article>`).join('')}</div>` : `<p class="minf-empty">${s.day ? e(s.day) + ' の' : ''}この分類の通知はありません。</p>`}${notificationPager(rows.length)}${s.kind === 'other' ? '<p class="minf-other-note">「その他・未分類」は、既知ルールに一致しなかった通知です。本文が欠けた記録は「本文不足」と明記し、推測だけで別カテゴリには入れません。</p>' : ''}</section>`;
  }
  function renderFavorites() {
    const s = favoriteState, rows = D.data.creators.filter(p => favorites.has(p.id)), visible = rows.filter(p => s.filter === 'all' || (s.filter === 'ungrouped' ? !s.assigned[p.id] : s.assigned[p.id] === s.filter));
    const count = group => rows.filter(p => (s.assigned[p.id] || '') === group).length;
    return `<section class="miff"><header class="miff-head"><div><small>FAVORITE CREATOR GROUPS</small><h2>お気に入り・グループ管理</h2><p>通知フィルターのグループとは別。お気に入りクリエイターをグループ分けして管理します。</p></div><button type="button" data-c-action="favorites-reload">再読込</button></header>${syntheticNotice}<div class="miff-create"><input data-c-input="favorite-new-group" aria-label="新しいグループ名" value="${e(s.newGroup)}" maxlength="40" placeholder="例：必ず読む / AI / 仲間"><button type="button" data-c-action="favorite-create" ${s.newGroup.trim() ? '' : 'disabled'}>＋ グループ作成</button></div><div class="miff-tabs"><button type="button" data-c-action="favorite-filter" data-c-value="all" class="${s.filter === 'all' ? 'active' : ''}">すべて <b>${rows.length}</b></button><button type="button" data-c-action="favorite-filter" data-c-value="ungrouped" class="${s.filter === 'ungrouped' ? 'active' : ''}">未分類 <b>${count('')}</b></button>${s.groups.map(g => `<button type="button" data-c-action="favorite-filter" data-c-value="${e(g)}" class="${s.filter === g ? 'active' : ''}">${e(g)} <b>${count(g)}</b></button>`).join('')}</div>${s.groups.length ? `<section class="miff-group-manage"><header><b>グループ管理</b><small>削除すると所属クリエイターは「未分類」に戻ります。</small></header><div>${s.groups.map(g => `<article><button type="button" class="group-open" data-c-action="favorite-filter" data-c-value="${e(g)}"><b>${e(g)}</b><small>${count(g)}人</small></button><div><button type="button" data-c-action="favorite-rename" data-c-value="${e(g)}">名前変更</button><button type="button" class="danger" data-c-action="favorite-delete" data-c-value="${e(g)}">グループ削除</button></div></article>`).join('')}</div></section>` : ''}${visible.length ? `<div class="miff-list">${visible.map(p => {
      const group = s.assigned[p.id] || '', articles = favoriteArticles(p).filter(a => matchesText([a.title, a.body], s.query));
      return `<article class="miff-creator"><div class="miff-person">${avatar(p.name, '')}<div><b>${e(p.name)}</b>${link('プロフィール ↗', 'profile', p.name)}<em class="${group ? '' : 'none'}">${e(group || '未分類')}</em></div></div><div class="miff-actions"><label><span>グループ</span><select data-c-input="favorite-assign" data-person="${p.id}" aria-label="${e(p.name)}のグループ"><option value="">未分類</option>${s.groups.map(g => `<option value="${e(g)}" ${g === group ? 'selected' : ''}>${e(g)}</option>`).join('')}</select></label><button type="button" class="miff-remove" data-c-action="favorite-remove" data-c-value="${p.id}" aria-label="${e(p.name)}をお気に入りから外す">★ 解除</button><button type="button" data-c-action="favorite-articles" data-c-value="${p.id}">${s.open === p.id ? '記事を閉じる' : '記事を見る'}</button></div>${s.open === p.id ? `<div class="miff-articles"><input data-c-input="favorite-query" value="${e(s.query)}" placeholder="記事を検索" aria-label="お気に入りの記事を検索">${articles.length ? `<div>${articles.map(a => `<article>${link('', 'favorite-article-preview', a.id).replace('></a>', `><span class="conversation-thumb ${p.color}" aria-hidden="true">${['✦', '☀', '✎', '☕'][Number(a.id.slice(-1))]}</span><div><small>${readArticles.has(a.id) ? '既読' : '● 未読'}・${fmt(a.date)}</small><b>${e(a.title)}</b><em>♡ ${a.likes}　💬 ${a.comments}</em></div></a>`)}<button type="button" data-c-action="favorite-read" data-c-value="${a.id}">${readArticles.has(a.id) ? '未読に戻す' : '既読にする'}</button></article>`).join('')}</div>` : '<p class="miff-empty">記事はありません。</p>'}</div>` : ''}</article>`;
    }).join('')}</div>` : `<p class="miff-empty">${rows.length ? 'このグループにはまだクリエイターがいません。' : 'お気に入りはまだありません。スキ履歴・順位・通知の☆から架空クリエイターを登録できます。'}</p>`}</section>`;
  }
  const rerender = () => D.render();
  function modalForm(title, html, onSubmit) {
    D.modal(title, `<form data-conversation-modal>${html}<p class="conversation-demo-note">体験データだけを変更します。サーバー保存はしません。</p><div class="conversation-modal-actions"><button type="button" data-conversation-cancel>キャンセル</button><button type="submit">${title.includes('削除') ? '削除する' : '変更する'}</button></div><p data-conversation-error role="alert"></p></form>`);
    const form = document.querySelector('[data-conversation-modal]');
    if (!form) return;
    const close = () => { const dialog = form.closest('dialog'); if (dialog && typeof dialog.close === 'function') dialog.close(); else { const closeButton = document.querySelector('[data-close-modal],.demo-modal-close,[data-modal-close]'); if (closeButton) closeButton.click(); else D.modal('操作を閉じました', '<p>体験画面に戻って続けられます。</p>'); } };
    form.querySelector('[data-conversation-cancel]').addEventListener('click', close);
    form.addEventListener('submit', event => { event.preventDefault(); const error = onSubmit(form); if (error) form.querySelector('[data-conversation-error]').textContent = error; else { close(); rerender(); } });
    form.querySelector('input')?.focus();
  }
  function bindCommon(root) {
    root.querySelectorAll('[data-c-action]').forEach(el => {
      const act = event => {
        event.preventDefault(); event.stopPropagation();
        const action = el.dataset.cAction, value = el.dataset.cValue || '';
        if (action === 'profile') return demoExplanation('プロフィールの表示例', `${value}は、この紹介サイトだけに登場する架空のクリエイターです。実際の機能ではプロフィールを開けます。`);
        if (action === 'article') return demoExplanation(value || '記事プレビュー', '架空の記事のプレビューです。元の機能では対象記事を開きますが、紹介サイトから本体やnoteへは移動しません。');
        if (action === 'magazine') return demoExplanation('マガジンの表示例', `${value}は架空のマガジンです。追加された記事と追加先を分けて確認する導線を紹介しています。`);
        if (action === 'comment-tab') { commentState.status = value; commentState.limit = 120; }
        else if (action === 'comment-search') { commentState.query = commentState.draft; commentState.limit = 120; }
        else if (action === 'comment-clear-day') { commentState.day = ''; commentState.article = ''; }
        else if (action === 'comment-more') commentState.limit += 120;
        else if (action === 'collect-comments') { commentState.collectionMessage = '取得操作の説明を表示しました。外部通信・取得は実行していません。'; rerender(); return demoExplanation('コメント取得のしくみ', '実際の機能はnoteからコメントを取得して履歴を更新します。この紹介サイトでは取得せず、架空のコメントだけを表示します。'); }
        else if (action === 'notice-handling') { notificationState.handling = value; notificationState.page = 1; }
        else if (action === 'notice-clear-day') { notificationState.day = ''; notificationState.page = 1; }
        else if (action === 'notice-page') notificationState.page = Number(value);
        else if (action === 'notice-complete') { const row = notifications.find(n => n.id === value); if (row) row.confirmed = !row.confirmed; D.toast('対応状況を体験画面内で切り替えました'); }
        else if (action === 'notice-favorite') { D.setFavorite(value); D.toast('架空クリエイターのお気に入りを切り替えました'); }
        else if (action === 'favorite-view') { D.go('favorites'); return; }
        else if (action === 'note-notifications') return demoExplanation('note通知への導線', '実際の画面にあるnote通知へのボタンを再現しています。この紹介サイトでは外部サイトやINSIGHT本体を開きません。');
        else if (action === 'consent-explain') return demoExplanation('自分のコメント保存は初期状態オフ', '本来は保存する情報を確認して同意し、その後note上でブラウザの有効化を確認する2段階の手順です。この説明を開いても同意にはならず、連携・端末登録・保存は行いません。');
        else if (action === 'consent-preview') { notificationState.previewEnabled = !notificationState.previewEnabled; D.toast('表示だけの切り替えです。実際の保存連携はオフのままです'); }
        else if (action === 'archive-refresh') return demoExplanation('自分のコメント履歴の更新', '実際の機能では保存済みの本文と会話を確認します。ここでは通信せず、あらかじめ用意した2件の架空データを表示しています。過去の未保存コメントを復元する機能ではありません。');
        else if (action === 'archive-link') return demoExplanation('保存したコメントへの導線', '実際の機能は対象コメントや記事を開きます。この紹介サイトでは外部リンクを持たず、架空の会話だけを確認できます。');
        else if (action === 'notice-reclassify') { notificationState.repairMessage = '再分類の説明：本文や根拠がある通知だけを分類します。体験画面では実際の再分類処理を実行していません。'; }
        else if (action === 'favorites-reload') return demoExplanation('お気に入りの再読込', '実際の機能ではアカウントに保存したお気に入りとグループを確認します。体験画面では通信せず、現在のローカル操作状態を保ちます。');
        else if (action === 'favorite-create') { const name = favoriteState.newGroup.trim().replace(/\s+/g, ' ').slice(0, 40); if (!name) return; if (['all', 'ungrouped'].includes(name)) return D.toast('別のグループ名を入力してください'); if (favoriteState.groups.includes(name)) return D.toast('同じ名前のグループがあります'); favoriteState.groups.push(name); favoriteState.newGroup = ''; favoriteState.filter = name; D.toast('体験画面内にグループを作成しました'); }
        else if (action === 'favorite-filter') favoriteState.filter = value;
        else if (action === 'favorite-rename') return modalForm('グループの名前変更', `<label>新しいグループ名<input name="groupName" value="${e(value)}" maxlength="40" required></label>`, form => { const name = form.elements.groupName.value.trim().replace(/\s+/g, ' ').slice(0, 40); if (!name || ['all', 'ungrouped'].includes(name)) return '別のグループ名を入力してください。'; if (name !== value && favoriteState.groups.includes(name)) return '同じ名前のグループがあります。'; favoriteState.groups = favoriteState.groups.map(g => g === value ? name : g); Object.keys(favoriteState.assigned).forEach(key => { if (favoriteState.assigned[key] === value) favoriteState.assigned[key] = name; }); if (favoriteState.filter === value) favoriteState.filter = name; D.toast('体験用グループの名前を変更しました'); });
        else if (action === 'favorite-delete') return modalForm('グループを削除', `<p>「${e(value)}」を削除しますか？ 所属クリエイターは「未分類」に戻ります。</p>`, () => { favoriteState.groups = favoriteState.groups.filter(g => g !== value); Object.keys(favoriteState.assigned).forEach(key => { if (favoriteState.assigned[key] === value) delete favoriteState.assigned[key]; }); if (favoriteState.filter === value) favoriteState.filter = 'all'; D.toast('体験用グループを削除しました'); });
        else if (action === 'favorite-remove') { D.setFavorite(value, false); D.toast('お気に入りを解除しました。スキ履歴や通知の☆から戻せます'); }
        else if (action === 'favorite-articles') { if (favoriteState.open !== value) favoriteState.query = ''; favoriteState.open = favoriteState.open === value ? '' : value; }
        else if (action === 'favorite-read') { if (readArticles.has(value)) readArticles.delete(value); else readArticles.add(value); }
        else if (action === 'favorite-article-preview') { const article = D.data.creators.flatMap(favoriteArticles).find(a => a.id === value); if (!article) return; readArticles.add(value); rerender(); return D.modal(article.title, `<p>${e(article.body)}</p><p>これは記事表示を紹介するために作成した架空の本文です。</p><p class="conversation-demo-note">画面内だけで既読にしました。実際の記事閲覧や外部通信は行っていません。</p>`); }
        else return;
        rerender();
      };
      el.addEventListener('click', act);
      if (el.tagName === 'A') el.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') act(event); });
    });
    root.querySelectorAll('[data-c-input]').forEach(el => {
      const type = el.dataset.cInput;
      if (type === 'comment-query') { el.addEventListener('input', () => { commentState.draft = el.value; }); el.addEventListener('keydown', event => { if (event.key === 'Enter') { commentState.query = el.value; commentState.limit = 120; rerender(); } }); }
      else if (type === 'favorite-new-group') { el.addEventListener('input', () => { favoriteState.newGroup = el.value; const button = root.querySelector('[data-c-action="favorite-create"]'); if (button) button.disabled = !el.value.trim(); }); el.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); root.querySelector('[data-c-action="favorite-create"]')?.click(); } }); }
      else if (type === 'favorite-query') el.addEventListener('input', () => { const start = el.selectionStart; favoriteState.query = el.value; rerender(); const field = document.querySelector('[data-c-input="favorite-query"]'); field?.focus(); field?.setSelectionRange(start, start); });
      else el.addEventListener('change', () => {
        if (type === 'comment-day') { commentState.day = el.value; commentState.article = ''; commentState.limit = 120; }
        else if (type === 'comment-article') { commentState.article = el.value; commentState.limit = 120; }
        else if (type === 'notice-kind') { notificationState.kind = el.value; notificationState.page = 1; }
        else if (type === 'notice-day') { notificationState.day = el.value; notificationState.page = 1; }
        else if (type === 'notice-page') notificationState.page = Number(el.value);
        else if (type === 'favorite-assign') { if (el.value) favoriteState.assigned[el.dataset.person] = el.value; else delete favoriteState.assigned[el.dataset.person]; D.toast('グループを体験画面内で変更しました'); }
        rerender();
      });
    });
    root.querySelectorAll('[data-c-detail]').forEach(el => el.addEventListener('toggle', event => {
      if (event.target !== el) return;
      const key = el.dataset.cDetail, s = notificationState;
      const retain = (set, value) => el.open ? set.add(value) : set.delete(value);
      if (key.startsWith('comment-')) retain(commentState.opened, key.slice(8));
      else if (key === 'archive') s.archiveOpen = el.open;
      else if (key === 'permission') s.permissionOpen = el.open;
      else if (key === 'accuracy') s.accuracyOpen = el.open;
      else if (key.startsWith('archive-')) retain(s.archiveItems, key.slice(8));
      else if (key.startsWith('notice-')) retain(s.details, key.slice(7));
    }));
  }
  V.comments = { render: renderComments, bind: bindCommon, guide: { title: 'コメントを1件ずつ、会話ごとにも', body: '全コメントの履歴と、未返信・相手返信などの対応状況を切り替えられます。すべて架空データです。', steps: ['「未返信」「相手返信」で対応が必要な会話を絞り込む', '会話を開いて本文と返信の流れを見る', '日付は2026/10/24、検索は「習慣」などで試す', '「自分返信」では最終返信への相手の♡の表示例も確認'] } };
  V.notifications = { render: renderNotifications, bind: bindCommon, guide: { title: '通知の分類と対応を一つの画面で', body: '分類・日付・対応済み・お気に入りを操作できます。自分のコメント保存は初期状態オフで、紹介サイトでは連携しません。', steps: ['分類を「自分の記事返信」にして会話を開く', '「対応済み」を押し、上の「対応済み」タブで確認', '☆を切り替えて、お気に入りに反映される様子を見る', '「自分のコメント履歴」で保存条件と対象外の範囲を読む'] } };
  V.favorites = { render: renderFavorites, bind: bindCommon, guide: { title: '読みたい人と記事を整理', body: 'お気に入りのグループ作成・名前変更・削除、記事検索、既読・未読の切り替えを画面内だけで試せます。', steps: ['グループ名を入力して「＋ グループ作成」', '「すべて」に戻り、各クリエイターのグループを選ぶ', '「記事を見る」を開いて記事を検索する', '「既読にする」と「未読に戻す」を切り替える'] } };
})();