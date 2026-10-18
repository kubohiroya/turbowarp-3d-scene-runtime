# 段階1: 3D scene source adapter

追跡: https://github.com/kubohiroya/turbowarp-3d-scene-runtime/issues/1 。共通親はextension-data-editor #18。

`./editor-schema`はdecodeSceneSource、validateSceneSource、producerのsceneSchemaBundlesを公開する。src/scene-input.tsへ既存planForの分岐を抽出し、runtimeも同じ関数へ委譲する。空文字/空白はempty no-op、scene3d/arキーを持てばwrapper、それ以外のobjectはbare。{}を空wrapperへ読み替えない。元source・format・raw data・variantを保持する。

検証は固定producer bundleの構造検証＋pure ownerの意味検証を呼び、dispatchやruntime capabilityへ触れない。source decode失敗を安全なdecode診断にし、失敗でもsourceを変更しない。正規化結果へ置換しない。

producerはscene-graph commit 7b8d67d47939b688895ed004bdbd035cd0fd6096、共通はa1ab4f4f5b384eef08ef26e544186ee9d8ad4543へ固定。ARはproducerから解決される0.3.0/planを使う。manifest/lockのGit取得先をこの2 SHAへ照合し、標準frozen installで再現を確認した。初回lock解決時だけpnpmのexotic subdependency制限に対応する一時オプションを使い、永続設定は変更していない。pnpmの動作は https://github.com/pnpm/pnpm.io/blob/main/docs/package-sources.md を参照。

確認: 型検査、新adapterと既存extensionの11テスト、Vite/独立emit、srcなし隔離import・strict型成功。隔離検証ではproducer内のARを実際の解決経路から同梱し、直接依存と取り違えない。

段階2のフォーム登録/owner encode/binding、後段の候補UIは未実装。既定OFFのGUIフラグは保持。新pure入口の利用停止/本Issueのcommit revertでrollbackし、保存済みsourceの移行は不要。
