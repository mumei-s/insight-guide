(() => {
  'use strict';
  const D = window.Demo, E = D.escape;
  const creators = D.data.creators.slice(0, 6);
  let status = 'all', scope = 'all', period = '', sort = 'newest', query = '', page = 1;
  const likes = creators.flatMap((creator, person) => D.data.articles.slice(0, 6 - person).map((article, j) => {
    const proposed = j === 5 ? '2026-09-29' : `2026-10-${24 - (person + j) % 3}`;
    return { person, creator, name: creator.name, article, date: proposed < article.date ? article.date : proposed, confirmed: (person + j) % 4 === 0 };
  })).map((row, id) => ({ ...row, id }));
  D.data.likeHistory = likes;
  function likeList() {
    const periodLength = scope === 'year' ? 4 : scope === 'month' ? 7 : 10;
    const rows = likes.filter(r => (status === 'all' || r.confirmed === (status === 'completed')) && (!query || `${r.name} ${r.creator.handle} ${r.article.title}`.toLowerCase().includes(query.toLowerCase())) && (!period || scope === 'all' || r.date.slice(0, periodLength) === period));
    return rows.sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name, 'ja') : sort === 'oldest' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date));
  }
  function likesRender() {
    const rows = likeList(), pages = Math.max(1, Math.ceil(rows.length / 6));
    page = Math.max(1, Math.min(page, pages));
    return `<div class="miu"><main><section class="miu-panel">${D.sectionHead('LIKE HISTORY', 'スキ全履歴', `${rows.length}件`)}
      <div class="miu-tabs">${[['all', 'すべて'], ['pending', '未対応'], ['completed', '対応済み']].map(([id, n]) => `<button data-status="${id}" class="${status === id ? 'active' : ''}" aria-pressed="${status === id}">${n}</button>`).join('')}</div>
      <div class="miu-tools"><div class="miu-tabs mini">${[['all', '全期間'], ['day', '日ごと'], ['month', '月ごと'], ['year', '年ごと']].map(([id, n]) => `<button data-scope="${id}" class="${scope === id ? 'active' : ''}" aria-pressed="${scope === id}">${n}</button>`).join('')}</div>
      ${scope !== 'all' ? `<label class="demo-field"><span>対象${scope === 'year' ? '年' : scope === 'month' ? '月' : '日'}</span><input id="like-period" type="${scope === 'day' ? 'date' : scope === 'month' ? 'month' : 'number'}" ${scope === 'year' ? 'min="1900" max="2100" step="1" inputmode="numeric"' : ''} value="${E(period)}"></label>` : ''}
      <select id="like-sort" aria-label="スキ履歴の並べ替え">${[['newest', '新しい順'], ['oldest', '古い順'], ['name', '名前順']].map(([v, n]) => `<option value="${v}" ${sort === v ? 'selected' : ''}>${n}</option>`).join('')}</select><input id="like-search" value="${E(query)}" placeholder="名前・ID・記事" aria-label="スキ履歴を検索"><button id="like-search-button">検索</button></div>
      <p class="miu-source">保存済み履歴の表示例 · 架空データ ${rows.length}件</p><div class="miu-card-grid">${rows.slice((page - 1) * 6, page * 6).map(r => {
        const favorite = D.isFavorite(r.creator.id);
        return `<article class="miu-like${r.confirmed ? ' is-handled' : ''}" data-person-id="${r.creator.id}"><div class="miu-like-person">${D.person(r.name, r.creator.letter)}</div><div class="miu-like-actions"><button data-favorite="${r.id}" class="miu-star ${favorite ? 'active' : ''}" aria-label="${E(r.name)}のお気に入り${favorite ? '解除' : '登録'}" aria-pressed="${favorite}">${favorite ? '★' : '☆'}</button><button class="miu-handled" data-complete="${r.id}" aria-pressed="${r.confirmed}" aria-label="${r.confirmed ? '未対応に戻す' : '対応済みにする'}">${r.confirmed ? '✓ 対応済み' : '対応済み'}</button></div><button class="demo-article-link" data-article="${r.article.id}">${E(r.article.title)}</button><time>${r.date} 18:30</time></article>`;
      }).join('') || '<p class="miu-empty">この条件の架空データはありません。</p>'}</div>
      <nav class="miu-pager" aria-label="スキ履歴のページ"><button id="likes-prev" ${page === 1 ? 'disabled' : ''}>← 前</button><span>${page} / ${pages}</span><button id="likes-next" ${page === pages ? 'disabled' : ''}>次 →</button></nav></section></main></div>`;
  }
  window.DemoViews.likes = {
    render: likesRender,
    guide: { title: 'スキ全履歴', body: '誰がどの記事に反応したかを、期間・名前・記事で探す画面です。対応済みとお気に入りの役割は別です。', steps: ['「未対応」で、確認したい履歴に絞る', 'カードの「対応済み」を押して状態を切り替える', '☆を押す・記事名で検索・日/月/年を切り替える'], note: 'お気に入りは順位・本人通知・お気に入り管理にも反映。変更はページ内だけで、再読込すると戻ります。' },
    bind(root) {
      root.querySelectorAll('[data-status]').forEach(b => b.onclick = () => { status = b.dataset.status; page = 1; D.render(); });
      root.querySelectorAll('[data-scope]').forEach(b => b.onclick = () => { scope = b.dataset.scope; period = ''; page = 1; D.render(); });
      root.querySelector('#like-sort').onchange = event => { sort = event.target.value; page = 1; D.render(); };
      const input = root.querySelector('#like-search'), search = () => { query = input.value.trim(); page = 1; D.render(); };
      input.onkeydown = event => { if (event.key === 'Enter') search(); };
      root.querySelector('#like-search-button').onclick = search;
      const periodInput = root.querySelector('#like-period');
      if (periodInput) periodInput.onchange = event => {
        const next = event.target.value;
        if (next === period) return;
        period = next; page = 1; D.render();
      };
      root.querySelectorAll('[data-complete]').forEach(b => b.onclick = () => { const row = likes[Number(b.dataset.complete)]; row.confirmed = !row.confirmed; D.render(); D.toast('デモ内の対応状況を変更しました'); });
      root.querySelectorAll('[data-favorite]').forEach(b => b.onclick = () => { D.setFavorite(likes[Number(b.dataset.favorite)].creator.id); D.render(); D.toast('デモ内のお気に入りを変更しました'); });
      root.querySelector('#likes-prev').onclick = () => { page--; D.render(); };
      root.querySelector('#likes-next').onclick = () => { page++; D.render(); };
    }
  };
  const rankOpen = { likes: null, comments: null };
  function rankData(comment) {
    return creators.map(creator => {
      const records = comment ? (D.data.commentThreads || []).filter(t => t.person.id === creator.id) : likes.filter(r => r.creator.id === creator.id);
      const articleIds = [...new Set(records.map(r => typeof r.article === 'string' ? r.article : r.article.id))];
      const articles = articleIds.map(id => {
        const a = D.data.articles.find(article => article.id === id);
        const record = records.find(r => (typeof r.article === 'string' ? r.article : r.article.id) === id);
        return { ...a, id, title: a?.title || record?.title || '架空の記事', body: record?.body || '', date: (record?.date || a?.date || '').slice(0, 10) };
      });
      return { creator, count: comment ? records.length : articles.length, articles, last: records.map(r => r.date).sort().at(-1)?.slice(5, 10).replace('-', '/') || '—' };
    }).sort((a, b) => b.count - a.count || a.creator.name.localeCompare(b.creator.name, 'ja'));
  }
  function rankingRender(comment) {
    const ranks = rankData(comment), key = comment ? 'comments' : 'likes';
    let place = 1;
    return `<div class="miu"><main><section class="miu-panel">${D.sectionHead(comment ? 'COMMENT RANKING' : 'SUPPORTER RANKING', comment ? '初手コメント順位' : '全記事スキランキング', `${ranks.length}人`)}<p class="miu-source">${comment ? '初手コメ＝親コメント件数。対象記事＝重複を除いた記事数。差分は「重複初手」に表示します。' : '記事数を押すと、スキしてくれた記事が開きます。'} <span class="demo-data-badge">架空データ</span></p><div class="miu-rank-list ${comment ? 'miu-comment-ranks' : ''}">${ranks.map((r, i) => {
      if (i && r.count !== ranks[i - 1].count) place = i + 1;
      const open = rankOpen[key] === r.creator.id, favorite = D.isFavorite(r.creator.id);
      return `<article data-person-id="${r.creator.id}"><div class="${comment ? 'miu-comment-rank-row' : 'miu-rank-row'}"><em>${place}</em>${D.person(r.creator.name, r.creator.letter)}${comment ? `<div class="miu-rank-metrics"><button data-rank="${r.creator.id}" aria-expanded="${open}"><b>${r.count}</b><small>初手コメ ▾</small></button><span><b>${r.articles.length}</b><small>対象記事</small></span><span class="${r.count > r.articles.length ? 'mismatch' : ''}"><b>${r.count > r.articles.length ? '+' : ''}${r.count - r.articles.length}</b><small>重複初手</small></span><time><b>${r.last}</b><small>最終コメント</small></time></div>` : `<button class="miu-star ${favorite ? 'active' : ''}" data-rank-star="${r.creator.id}" aria-label="${E(r.creator.name)}のお気に入り${favorite ? '解除' : '登録'}" aria-pressed="${favorite}">${favorite ? '★' : '☆'}</button><button data-rank="${r.creator.id}" aria-expanded="${open}"><b>${r.count}</b><small>記事 ▾</small></button>`}</div>${open ? `<div class="miu-expand">${r.articles.map(a => `<button class="demo-rank-detail" data-article="${a.id}"><span><b>${E(a.title)}</b>${comment ? `<small>${E(a.body)}（架空のコメント）</small>` : ''}</span><time>${a.date.slice(5).replace('-', '/')}</time></button>`).join('') || '<p class="miu-empty">表示する記事はありません。</p>'}</div>` : ''}</article>`;
    }).join('')}</div></section></main></div>`;
  }
  function bindRank(root, comment) {
    const key = comment ? 'comments' : 'likes';
    root.querySelectorAll('[data-rank]').forEach(b => b.onclick = () => { const id = b.dataset.rank; rankOpen[key] = rankOpen[key] === id ? null : id; D.render(); });
    root.querySelectorAll('[data-rank-star]').forEach(b => b.onclick = () => { D.setFavorite(b.dataset.rankStar); D.render(); D.toast('デモ内のお気に入りを変更しました'); });
  }
  window.DemoViews.supporters = { render: () => rankingRender(false), bind: root => bindRank(root, false), guide: { title: '全記事スキランキング', body: 'スキしてくれた記事数を人物別に確認。数字の合計から、具体的な記事へと掘り下げられます。', steps: ['右側の記事数を押す', '同じ人が反応した記事の一覧を開く', '☆で気になる相手をお気に入りにする'], note: 'スキ履歴と同じ架空データを集計しています。公式のスキ総数とは集計範囲が異なる場合があります。' } };
  window.DemoViews.commentRanking = { render: () => rankingRender(true), bind: root => bindRank(root, true), guide: { title: '初手コメント順位', body: '返信ではない親コメントを起点に、交流の広がりを確認します。「最初にコメントした順位」ではありません。', steps: ['初手コメ数を押して記事と本文を展開', '対象記事数と親コメント件数を見比べる', '同じ記事への複数の親コメントは「重複初手」に表示'], note: 'コメント画面と同じ架空の親コメントを集計。同数は同じ順位で表示します。' } };
})();