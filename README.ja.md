# TurboWarp-3D-Scene-Runtime

<img src="assets/block-icon.svg" alt="" width="48" height="48">

[English](README.md) | 日本語

TurboWarp-3D-Scene-Runtime は、YAML または JSON で書いた 3D/AR シーンを適用する拡張です。1つのブロックが記述を受け取り、検証して呼び出し計画へ変換し、`turbowarp-aframe` と `turbowarp-ar` のランタイム capability を呼んでシーンを構築します。

記述が唯一の真実のまま残ります。ブロック列へコンパイルしないので、編集したシーンの再適用はブロック1回の呼び出しで済み、プロジェクトを書き換える必要がありません。

`./editor-metadata`と既存`./editor-schema`はSchema宣言とpure owner検証を提供し、編集用Schema compileとAjvは共通GUIが担当します。
詳細と互換性は[編集とruntimeの境界](docs/editor-runtime-boundary.ja.md)を参照してください。

## できること

- scene graph document、または両方を持つ `{scene3d, ar}` 断片を受け取ります。
- `@kubohiroya/turbowarp-scene-graph` で検証・正規化し、id と既定値を埋めます。
- AR より先に 3D シーンを構築するため、AR target の bind 先 node が既に存在します。
- 状態・準備完了・直近のエラーをブロックで返します。script を止めません。
- 構築できないとき、どの連携拡張が不足しているか・古いかを報告します。

## 要件と安全性

- TurboWarp の **Run extension without sandbox**。
- 3D ノードを含むシーンには `turbowarp-aframe` 0.7.0 以降を同じ作品に読み込むこと。
- `ar` 断片を含むシーンには `turbowarp-ar` 0.4.0 以降と `turbowarp-camera-source`。
- AR を使う場合は secure context とカメラ許可。

この拡張自身は入出力を行いません。作品から渡されたテキストを読み、2つの連携拡張を呼ぶだけです。カメラ・ネットワーク・DOM の所有はそれらの側に残ります。

## インストール

連携拡張を先に読み込み、その後にこの拡張を unsandboxed custom extension として読み込みます。

```text
https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-3d-scene-runtime@0.5.0/dist/3d-scene-runtime.js
```

ローカル開発:

```bash
pnpm add @kubohiroya/turbowarp-3d-scene-runtime@0.5.0
```

## クイックスタート

```text
apply 3D scene [formatVersion: 1
root:
  children:
    - type: box
      id: card
      class: monster
      attributes:
        position: 0 1 -3]
```

AR を使う場合は両方の断片を渡します。

```yaml
scene3d:
  formatVersion: 1
  root:
    children:
      - type: box
        id: card
ar:
  cameraId: front
  targets:
    - targetId: marker-1
      selector: "#card"
```

素の document は `scene3d` として扱うため、3D だけの作品は入れ子にする必要がありません。空の記述は何も適用せず、エラーにもなりません。

## 連携拡張への到達方法

`Scratch.vm.runtime.turbowarpAFrameCapability` と `Scratch.vm.runtime.turbowarpARCapability` を読み、version 番号で門番するのではなく使う method の存在を検査します。両 capability が成長すると文書化されている方式に合わせたものです。capability が無い場合、あるいは呼び出し計画に必要な method を持たない場合は、拡張名とそれを提供する version を添えて `3D scene error` で報告します。

必要なのはシーンが実際に使う capability だけです。`ar` 断片の無いシーンは `turbowarp-ar` が読み込まれていなくても構築できます。

`ar` 断片を含むシーンを適用するときは、先に実行中の AR セッションを停止します。再適用で古いカメラ lease が残りません。

## ブロック一覧

<!-- BEGIN GENERATED BLOCKS -->
<!-- END GENERATED BLOCKS -->

## 互換性

拡張 ID は `kubohiroya3dsceneruntime` です。拡張 ID や opcode 名の変更には SB3 の移行計画が必要です。

## 統合ビルド用module API

このソースのbuildは、単体JSとは別に、統合用のESM入口`./bundle-module`と
型宣言を`lib-module/`へ生成します。

```ts
import {bundleModuleMetadata, createExtension, type ScratchApi}
  from '@kubohiroya/turbowarp-3d-scene-runtime/bundle-module';

export function createMember(memberScratch: ScratchApi) {
  return createExtension(memberScratch);
}
```

import時はglobal Scratch / window / documentを参照せず、拡張の生成・登録を行いません。
明示的なcreateExtension(memberScratch)ごとに新しいinstanceを返し、後から実行する
ブロック・編集用補助処理・lifecycle callbackも同じhostを使います。factoryは
Scratch.extensions.registerを呼びません。単体entryも同じfactoryを使い、登録は1回です。

凍結されたbundleModuleMetadataはformatVersion: 1、元のid、unsandboxed条件を
宣言します。統合hostが生成前に検査し、登録とdisposeを管理します。ID・opcode・
保存データ形式を変更しません。

scene解析とA-Frame / ARへのdispatchは従来の動作を維持し、注入hostのruntime capabilityを使います。明示的に呼べる冪等なdispose()で、このinstanceの編集登録とlistenerを解除します。RUNTIME_DISPOSEDも同じ解除処理を使います。A-Frame / ARが所有するsceneを破棄する操作ではありません。TurboWarp3DSceneRuntimeExtensionを直接newする内部コードでもhostを明示的に渡します。

yaml等のruntime依存とそのsubpathは外部importのまま保持します。既存の小さな編集用
純粋ヘルパーだけを含め、production consumerには編集packageやGUIエンジンを要求しません。
公開型は既存tsconfigと同じES2022の型ライブラリを使い、生成JSはES2020を対象とします。
既存exportsを維持して./bundle-moduleを追加し、templateへのruntime依存は追加しません。

pnpm run build:moduleで生成し、pnpm run check:moduleは実tarballをproduction依存だけの
consumerへinstallしてhost分離・単体版との動作一致・公開型・編集エンジンの非混入を検査します。
sb3-toolchain側の統合buildは[sb3-toolchain #65](https://github.com/kubohiroya/sb3-toolchain/issues/65)の後続です。
切戻しはこのmodule入口を選択せず従来のclassic distを読み込みます。新しいruntimeフラグや
保存データの移行は導入しません。

## 開発

production依存はscene-graph 0.2.3（上流AR 0.4.2）とyamlです。data-editorは型・編集契約テスト用の開発依存とし、`pnpm run check:production-deps`で推移的なAjv／編集engineの混入を検出します。未公開候補の検証方法と公開順序は[編集境界](docs/editor-runtime-boundary.ja.md)を参照してください。

```bash
npm install --global corepack@latest
corepack enable
pnpm install --frozen-lockfile
pnpm run check
```

生成される拡張バンドルは `dist/3d-scene-runtime.js`、決定的な API manifest は `dist/extension-manifest.json` です。

## ライセンス

MPL-2.0。[LICENSE](LICENSE) を参照してください。
