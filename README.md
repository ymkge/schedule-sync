# Schedule Sync (スケジュール同期アプリ)

Schedule Syncは、CalendlyやSpirのような日程調整アプリケーションです。あなたのGoogleカレンダーと連携し、空き時間を自動的に見つけ出し、他の人が簡単に会議を予約できるユニークな共有リンクを提供します。

## 主な機能

- **Googleカレンダー連携**: OAuth 2.0を使用して、安全にGoogleカレンダーに接続します。
- **空き時間の自動生成**: カレンダーの予定やあらかじめ設定した稼働時間に基づき、予約可能な時間枠を自動で計算します。
- **週別カレンダー表示**: 同期した予約枠を、週ごとのカレンダー形式で視覚的に確認できます。
- **共有可能な予約リンク**: あなた専用の予約ページのユニークなURLを生成します。
- **ワンクリック予約**: 面倒なやり取りなしに、数クリックで予約が完了します。
- **会議リンクの自動発行**: 予約されたイベントごとに、Google Meetの会議リンクが自動で作成されます。
- **ダブルブッキング防止**: ある時間枠が予約されると、他の人が同じ時間を予約することはできません。

## 技術スタック

- **フロントエンド**: Next.js, React, TypeScript, Tailwind CSS
- **バックエンド**: Python, FastAPI
- **データベース**: Google Cloud Firestore
- **API・認証**: Google Calendar API, Google People API, Google OAuth 2.0
- **デプロイ環境 (計画)**: Docker, Google Cloud Run

## プロジェクト構造

```
/schedule-sync
├── /backend/      # FastAPI アプリケーション (バックエンド)
└── /frontend/     # Next.js アプリケーション (フロントエンド)
```

## ローカル開発環境のセットアップ

### 前提条件

- Node.js (v18 以上)
- Python (v3.9 以上)
- Google Cloud プロジェクトが作成済みであること
- `gcloud` CLI がインストール・認証済みであること
- Google Cloud プロジェクトで **Cloud Firestore API が有効化済み** であること
- コンピュータのシステム時刻が正しく設定されていること

### 1. バックエンドのセットアップ

1.  **バックエンドディレクトリに移動します:**
    ```bash
    cd backend
    ```

2.  **Pythonの仮想環境を作成・有効化します:**
    ```bash
    python -m venv venv
    source venv/bin/activate
    ```
    *Windowsの場合は `venv\Scripts\activate` を実行します。*

3.  **必要なライブラリをインストールします:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **環境変数を設定します:**
    - `backend`ディレクトリにある`.env.example`ファイルをコピーして、`.env`という名前のファイルを作成します。
    - `.env`ファイルを開き、Google Cloudプロジェクトから取得した認証情報（`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`）と、ご自身のデータベース設定（`FIRESTORE_PROJECT_ID`）を記述します。
    - `JWT_SECRET_KEY`には、任意の長いランダムな文字列を設定してください（例: `openssl rand -hex 32` で生成）。
      ```
      GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
      GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"
      REDIRECT_URI="http://localhost:3000"
      SECRET_KEY="YOUR_SUPER_SECRET_KEY"
      FIRESTORE_PROJECT_ID="YOUR_FIRESTORE_PROJECT_ID"
      ```

5.  **バックエンドサーバーを起動します:**
    ```bash
    uvicorn main:app --host 0.0.0.0 --port 8080 --reload
    ```
    サーバーが `http://127.0.0.1:8080` で起動します。

### 2. フロントエンドのセットアップ

1.  **フロントエンドディレクトリに移動します:**
    ```bash
    cd frontend
    ```

2.  **必要なライブラリをインストールします:**
    ```bash
    npm install
    ```

3.  **環境変数を設定します:**
    - `frontend`ディレクトリの直下に`.env.local`というファイルを作成します。
    - ファイルに以下の内容を記述します。これにより、フロントエンドがバックエンドAPIの場所を認識できるようになります。
      ```
      NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8080
      ```

4.  **フロントエンドサーバーを起動します:**
    ```bash
    npm run dev
    ```
    アプリケーションが `http://localhost:3000` で利用可能になります。

## 利用方法

1.  **ログイン**: `http://localhost:3000` にアクセスし、Googleアカウントでログインします。
2.  **カレンダー同期**: ログイン後、ダッシュボードが表示されます。「Re-Sync Calendar」ボタンを押すと、Googleカレンダーとの同期が実行されます。
3.  **予約枠の確認**: 同期が完了すると、予約可能な時間枠が週別のカレンダー形式でダッシュボードに表示されます。「‹ Prev」「Next ›」ボタンで週を移動できます。
4.  **リンク共有**: (今後実装) あなた専用の予約リンク（例: `http://localhost:3000/<あなたの公開トークン>`）を他の人に共有します。
5.  **予約受付**: (今後実装) 共有された相手はリンクにアクセスし、空いている時間を選んで予約します。予約内容は自動的にあなたのGoogleカレンダーに登録されます。

## 今後の開発タスク (Next Steps)

- [x] **ユーザー設定機能の実装:**
    - 予約可能な時間帯（例: 9:00-17:00）を設定する機能。
    - 予約枠の長さ（例: 30分、60分）を変更する機能。
- [ ] **`.env.example` の更新:** `SECRET_KEY` の記述を現在の実装に合わせる。
- [ ] **セキュリティ向上:** 現在JWTの署名と内部データの暗号化で共用している `SECRET_KEY` を、それぞれ別のキー (`JWT_SECRET_KEY`, `FERNET_KEY`) に分離する。

---

### 完了済みのタスク

- ✅ **Step 1: 公開予約ページのUI実装**
  - `frontend/app/[token]/page.tsx`にて、週別カレンダービューを実装済み。
- ✅ **Step 2: 予約作成機能の実装**
  - カレンダーでの時間選択、フォームによる予約作成機能を実装済み。
- ✅ **Step 3: 全体的な品質向上**
  - レスポンシブデザイン対応
  - エラーハンドリングの強化
  - ローディング表示の改善

## ライセンス

このプロジェクトは **MITライセンス** の下で公開されています。詳細は [LICENSE](LICENSE) ファイルをご覧ください。
