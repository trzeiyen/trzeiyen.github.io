# ZEIYEN LAB v2 Prototype

這個資料夾是新版首頁的概念驗證，不會影響目前正式 `index.html`。

## 核心改動

- 視覺定位從「教具清單」提升為「教育創作者 / 教學實驗室」
- 作品卡片由 `data/projects.json` 自動產生
- 分類篩選由資料自動建立
- 新增作品時，不必修改卡片 HTML
- 保留純靜態架構，可直接相容 GitHub Pages
- 未來可接 GitHub-based CMS 或自訂管理後台

## 新增一個作品

只要在 `data/projects.json` 加一筆：

```json
{
  "title": "新作品",
  "category": "臺灣史",
  "grade": "五年級",
  "description": "作品說明",
  "url": "../tools/new-tool.html"
}
```

網站會自動產生卡片與分類篩選。

## 下一階段

1. 把目前首頁所有作品完整搬入 JSON
2. 加入搜尋、標籤、精選作品
3. 增加作品詳細頁
4. 接 CMS，做到登入後填表即可更新
