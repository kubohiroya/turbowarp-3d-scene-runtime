# 編集metadataとruntimeの境界

追跡: [共通data-editor #72](https://github.com/kubohiroya/turbowarp-extension-data-editor/issues/72)。
Camera Source #52と同じ責務分担を適用する。

3D Scene Runtimeは既存YAML reader、bare/wrapperの分岐、scene-graphの正本Schemaとpure owner検証を利用する。
Schema compile、Schema制約の診断、フォーム描画、下書き／保存／Cancelは共通data-editor／GUIが担当する。

`validateSceneSource` はimport時にSchemaをcompileせず、decodeとowner検証を担当する。戻り値の原文と未正規化dataを保持する。
共通Source/Formは同じSchemaBundleでSchema制約も検証してから保存する。
既存`./editor-schema`は維持するが、このowner callbackだけからSchema keyword別診断は返さない。
その診断が必要な独自consumerは、自身の共通data-editorでSchema検証を組み合わせる。

新しい`./editor-metadata`は既存Schema/decode/owner APIとSource/Form登録定義を一つの入口から公開する。
旧入口と同じSchemaBundleインスタンスを使い、正本Schemaをコピーしない。
GUI/DOM/VMなし、data-editor package未導入の隔離環境で両入口をimportできることを確認する。
型宣言の共通型を使うTypeScript consumerは自身の開発依存にdata-editorを追加する。

data-editorの直接依存はdevDependenciesへ移す。standaloneとmetadataの実行graphにはAjv／Schema compilerを含めない。
ただし現行の上流scene-graph 0.2.2はdata-editorをproduction依存として宣言しているため、npmの推移的な
インストール依存は残る。本変更の「実行graph・配布JSからの除去」とは区別する。上流宣言の整理とそのreleaseは別途必要である。

空sourceのcontext-freeなno-op、bare/wrapper/JSON/YAMLの分岐、owner受理条件、既存opcode・保存形式を維持する。
GUIなし/旧GUI/編集フラグOFFでも通常blockを実行できる。通常のYAML解析はruntime機能として維持する。
yaml共有化は[sb3-toolchain #65](https://github.com/kubohiroya/sb3-toolchain/issues/65)で後続対応する。

問題時はGUI編集フラグをOFFにして再読込し、必要なら検証済みexact pin・lock・生成物へ一組で戻す。
保存済みsourceの移行や公開済みversionの上書きは行わない。
開発時は`pnpm run build`で公開metadataを生成してから対象テストを実行する。
テストのVM／共通サービスによる確認と、実ブラウザ／3D描画の確認は区別して報告する。

## ローカル検証記録（2026-10-24）

- 基準: 公開main `c5f1794235c7`。standalone JSは540,216 Bから236,395 Bへ変更。
- gzip level 9（参考値）は116,166 Bから55,512 B。SB3削減量や実行時RAMの測定値ではない。
- 対象テスト26件、型検査、変更したTypeScriptのESLint、standalone／metadata build、package export・repo policy確認が成功。
- GUIなしVMで通常登録1回、Ajv生成0回、編集用SchemaBundle compile 0回。2拡張をsb3-toolchain 0.16.0で束ねても同じ結果。
- 共通サービス経由のSchema制約拒否、owner受理条件、raw no-op／変更時commit、旧GUIでの非登録、隔離metadata importを確認。
- 実ブラウザ・3D描画・実カメラの確認、push、PR、merge、npm公開はこのローカル検証に含めない。
