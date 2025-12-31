# X Mobile Optimizer for Android

Androidブラウザ（Kiwi Browser, Lemur Browser等）向けの、Web版X（旧Twitter）最適化拡張機能です。
広告の非表示やサイドバーの削除による高速化と、リップルエフェクトなどのアニメーション追加によるUX向上を実現します。

## 機能概要

### Speed Mode (高速化)
タイムラインの表示を高速化し、不要な要素を削除します。
- **広告除去**: プロモーションツイートを非表示にします。
- **サイドバー非表示**: デスクトップ表示時のトレンドなどのサイドバーを削除します。
- **不要なナビゲーションの整理**: GrokやPremiumなどのボタンを整理します。

### Motion Mode (アニメーション)
ネイティブアプリのような操作感を追加します。
- **リップルエフェクト**: タップ時に波紋アニメーションを表示します。
- **フェードイン**: 新しいツイートが読み込まれる際にふわっと表示します。

## インストール方法

1. **拡張機能対応ブラウザの準備**:
   Android端末に [Kiwi Browser](https://play.google.com/store/apps/details?id=com.kiwibrowser.browser) または [Lemur Browser](https://play.google.com/store/apps/details?id=com.lemurbrowser.exts) をインストールします。

2. **拡張機能の読み込み**:
   - ビルド済みの `.zip` ファイルまたは `.crx` ファイルを端末に保存します。
   - ブラウザのメニューから「拡張機能 (Extensions)」を開きます。
   - 「デベロッパーモード (Developer mode)」をオンにします。
   - 「+(from .zip/.crx/.user.js)」ボタンをタップし、保存したファイルを選択します。

3. **設定**:
   - ブラウザのメニューから「X Mobile Optimizer」を選択（または拡張機能アイコンをタップ）して設定画面を開きます。
   - Speed Mode, Motion Modeをお好みで切り替えてください。

## 開発者向け情報

### ビルド
ソースコードをZIPに圧縮するだけでパッケージング可能です。

### ディレクトリ構成
- `manifest.json`: 拡張機能の設定ファイル (Manifest V3)
- `src/content_scripts`: ページ上で動作するスクリプト
    - `optimizer.js`: 高速化ロジック
    - `animator.js`: アニメーションロジック
- `src/popup`: 設定画面のUI

---
Designed for Android Power Users.
