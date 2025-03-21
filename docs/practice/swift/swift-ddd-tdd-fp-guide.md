# プログラミング実践ガイド: DDD + TDD + FP

## 基本原則

### 関数型プログラミング (FP)

- 純粋関数を優先
- 不変データ構造の使用（値型の活用）
- 副作用の分離
- 型安全性の重視

### ドメイン駆動設計 (DDD)

- ユビキタス言語の採用
- 境界づけられたコンテキスト
- 値オブジェクトとエンティティの区別
- リポジトリによるデータアクセス抽象化

### テスト駆動開発 (TDD)

- Red-Green-Refactorサイクル
- 小さな単位でのインクリメンタルな開発
- テストをドキュメントとして活用
- 継続的なリファクタリング

## 実装パターン

### 軽量実装構造

```
MyApp/
├── Core/            # 基本ユーティリティ
│   └── Extensions/    # 拡張機能
├── Domain/          # ドメインモデル
│   ├── Models/        # 値オブジェクト、エンティティ
│   ├── Services/      # ドメインサービス
│   └── Errors/        # エラー型
├── Adapters/        # 外部依存抽象化
│   └── Repositories/  # リポジトリ実装
└── App/             # アプリケーション層
    └── Services/      # アプリケーションサービス
```

### Result型の活用

```swift
// Swiftには標準ライブラリにResult型が組み込まれています
import Foundation

// ドメイン固有のエラー型
enum DomainError: Error, LocalizedError {
    case validation(String)
    case notFound(String)
    case business(String)
    case system(String)
    
    var errorDescription: String? {
        switch self {
        case .validation(let message): return "バリデーションエラー: \(message)"
        case .notFound(let message): return "見つかりません: \(message)"
        case .business(let message): return "ビジネスルールエラー: \(message)"
        case .system(let message): return "システムエラー: \(message)"
        }
    }
}

// Result型の拡張
extension Result {
    var isSuccess: Bool {
        switch self {
        case .success: return true
        case .failure: return false
        }
    }
    
    var isFailure: Bool {
        return !isSuccess
    }
    
    var value: Success? {
        switch self {
        case .success(let value): return value
        case .failure: return nil
        }
    }
    
    var error: Failure? {
        switch self {
        case .success: return nil
        case .failure(let error): return error
        }
    }
}
```

### ブランド付き型（型安全なID）

```swift
// IDのような値を型安全に扱うためのパターン
struct TaskId: Hashable, Identifiable {
    let value: String
    var id: String { value } // Identifiableプロトコル適合用
    
    // プライベートイニシャライザで直接生成を防止
    private init(_ value: String) {
        self.value = value
    }
    
    // ファクトリメソッドでバリデーション付き生成
    static func create(_ value: String) -> Result<TaskId, DomainError> {
        guard !value.isEmpty else {
            return .failure(DomainError.validation("タスクIDは空にできません"))
        }
        return .success(TaskId(value))
    }
    
    // 新しいIDの生成
    static func generateNew() -> TaskId {
        return TaskId(UUID().uuidString)
    }
}
```

### 値オブジェクト実装

```swift
// 値オブジェクトとその操作関数
struct Money: Equatable, Codable {
    let amount: Int
    
    // プライベートイニシャライザで直接生成を防止
    private init(amount: Int) {
        self.amount = amount
    }
    
    // ファクトリメソッド
    static func create(amount: Int) -> Result<Money, DomainError> {
        guard amount >= 0 else {
            return .failure(DomainError.validation("金額は0以上である必要があります"))
        }
        return .success(Money(amount: amount))
    }
    
    // ゼロ値
    static let zero = Money(amount: 0)
    
    // 加算操作（新しいインスタンスを返す）
    func add(_ other: Money) -> Money {
        return Money(amount: self.amount + other.amount)
    }
    
    // 減算操作（失敗の可能性があるためResult型を返す）
    func subtract(_ other: Money) -> Result<Money, DomainError> {
        let newAmount = self.amount - other.amount
        guard newAmount >= 0 else {
            return .failure(DomainError.validation("金額の減算結果が負の値になりました"))
        }
        return .success(Money(amount: newAmount))
    }
    
    // 乗算操作
    func multiply(_ quantity: Int) -> Money {
        return Money(amount: self.amount * quantity)
    }
}

// 値オブジェクトを含むエンティティ
struct Product: Identifiable, Equatable {
    let id: ProductId
    let name: String
    let price: Money
    let description: String?
    
    // 不変更新パターン - 価格変更
    func changePrice(newPrice: Money) -> Product {
        return Product(
            id: self.id,
            name: self.name, 
            price: newPrice,
            description: self.description
        )
    }
    
    // 不変更新パターン - 説明変更
    func updateDescription(newDescription: String?) -> Product {
        return Product(
            id: self.id,
            name: self.name,
            price: self.price,
            description: newDescription
        )
    }
}
```

### Adapterパターン

```swift
// リポジトリインターフェース
protocol Repository {
    associatedtype EntityType
    associatedtype IDType
    
    func findById(id: IDType) async -> Result<EntityType?, DomainError>
    func findAll() async -> Result<[EntityType], DomainError>
    func save(entity: EntityType) async -> Result<Void, DomainError>
    func remove(id: IDType) async -> Result<Void, DomainError>
}

// インメモリ実装（テスト用）
class InMemoryTaskRepository: Repository {
    typealias EntityType = Task
    typealias IDType = TaskId
    
    private var tasks: [String: Task] = [:]
    
    func findById(id: TaskId) async -> Result<Task?, DomainError> {
        return .success(tasks[id.value])
    }
    
    func findAll() async -> Result<[Task], DomainError> {
        return .success(Array(tasks.values))
    }
    
    func save(entity: Task) async -> Result<Void, DomainError> {
        tasks[entity.id.value] = entity
        return .success(())
    }
    
    func remove(id: TaskId) async -> Result<Void, DomainError> {
        tasks.removeValue(forKey: id.value)
        return .success(())
    }
}

// UserDefaults実装（永続化）
class UserDefaultsTaskRepository: Repository {
    typealias EntityType = Task
    typealias IDType = TaskId
    
    private let storageKey = "tasks"
    
    func findById(id: TaskId) async -> Result<Task?, DomainError> {
        do {
            let findAllResult = await findAll()
            guard case .success(let tasks) = findAllResult else {
                return .failure(findAllResult.error!)
            }
            
            return .success(tasks.first(where: { $0.id.value == id.value }))
        }
    }
    
    func findAll() async -> Result<[Task], DomainError> {
        do {
            guard let tasksData = UserDefaults.standard.data(forKey: storageKey) else {
                return .success([])
            }
            
            let decoder = JSONDecoder()
            let tasks = try decoder.decode([Task].self, from: tasksData)
            return .success(tasks)
        } catch {
            return .failure(DomainError.system("データ取得エラー: \(error.localizedDescription)"))
        }
    }
    
    func save(entity: Task) async -> Result<Void, DomainError> {
        do {
            let findAllResult = await findAll()
            guard case .success(let existingTasks) = findAllResult else {
                return .failure(findAllResult.error!)
            }
            
            var updatedTasks: [Task]
            if let index = existingTasks.firstIndex(where: { $0.id.value == entity.id.value }) {
                var tasks = existingTasks
                tasks[index] = entity
                updatedTasks = tasks
            } else {
                updatedTasks = existingTasks + [entity]
            }
            
            let encoder = JSONEncoder()
            let tasksData = try encoder.encode(updatedTasks)
            UserDefaults.standard.set(tasksData, forKey: storageKey)
            
            return .success(())
        } catch {
            return .failure(DomainError.system("データ保存エラー: \(error.localizedDescription)"))
        }
    }
    
    func remove(id: TaskId) async -> Result<Void, DomainError> {
        do {
            let findAllResult = await findAll()
            guard case .success(let existingTasks) = findAllResult else {
                return .failure(findAllResult.error!)
            }
            
            let updatedTasks = existingTasks.filter { $0.id.value != id.value }
            
            let encoder = JSONEncoder()
            let tasksData = try encoder.encode(updatedTasks)
            UserDefaults.standard.set(tasksData, forKey: storageKey)
            
            return .success(())
        } catch {
            return .failure(DomainError.system("データ削除エラー: \(error.localizedDescription)"))
        }
    }
}
```

### TDDの実践

```swift
// XCTestを使用したテスト例
import XCTest
@testable import MyApp

final class MoneyTests: XCTestCase {
    // 先にテストを書く
    func testCreateMoney_ValidAmount_ReturnsMoneyObject() {
        // Arrange & Act
        let result = Money.create(amount: 100)
        
        // Assert
        XCTAssertTrue(result.isSuccess)
        if case .success(let money) = result {
            XCTAssertEqual(money.amount, 100)
        }
    }
    
    func testCreateMoney_NegativeAmount_ReturnsError() {
        // Arrange & Act
        let result = Money.create(amount: -10)
        
        // Assert
        XCTAssertTrue(result.isFailure)
        if case .failure(let error as DomainError) = result {
            XCTAssertEqual(error.errorDescription, "バリデーションエラー: 金額は0以上である必要があります")
        }
    }
    
    func testAddMoney_TwoValidAmounts_ReturnsCombinedMoney() {
        // Arrange
        let money1 = try! Money.create(amount: 100).get()
        let money2 = try! Money.create(amount: 200).get()
        
        // Act
        let result = money1.add(money2)
        
        // Assert
        XCTAssertEqual(result.amount, 300)
    }
    
    func testSubtractMoney_ValidSubtraction_ReturnsRemainingMoney() {
        // Arrange
        let money1 = try! Money.create(amount: 100).get()
        let money2 = try! Money.create(amount: 40).get()
        
        // Act
        let result = money1.subtract(money2)
        
        // Assert
        XCTAssertTrue(result.isSuccess)
        if case .success(let money) = result {
            XCTAssertEqual(money.amount, 60)
        }
    }
}
```

## 実装戦略

### 関数型アプローチ

1. **型優先設計**
   - まず型を定義し、それに導かれる形で実装を進める
   - 複雑な型は小さな型の組み合わせで構築

   ```swift
   // 型優先設計の例
   struct Email {
       let value: String
       
       private init(value: String) {
           self.value = value
       }
       
       static func create(_ value: String) -> Result<Email, DomainError> {
           // メールアドレスのバリデーション
           let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
           let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
           
           guard emailPredicate.evaluate(with: value) else {
               return .failure(DomainError.validation("有効なメールアドレス形式ではありません"))
           }
           
           return .success(Email(value: value))
       }
   }
   ```

2. **純粋関数設計**
   ```swift
   // 純粋関数の例
   func calculateTax(amount: Money) -> Money {
       let taxRate = 0.1
       let taxAmount = Int(Double(amount.amount) * taxRate)
       return Money(amount: amount.amount + taxAmount)
   }

   // 副作用を含む関数は非同期で結果を返す
   func saveOrder(order: Order, repository: OrderRepository) async -> Result<Void, DomainError> {
       return await repository.save(entity: order)
   }
   ```

3. **不変更新パターン**
   ```swift
   // 状態変更ではなく新しいオブジェクトを返す
   func updateStatus(task: Task, newStatus: Status) -> Task {
       return Task(
           id: task.id,
           title: task.title,
           description: task.description,
           status: newStatus,
           createdAt: task.createdAt,
           updatedAt: Date()
       )
   }
   
   // または拡張メソッドとして実装
   extension Task {
       func updateStatus(newStatus: Status) -> Task {
           return Task(
               id: self.id,
               title: self.title,
               description: self.description,
               status: newStatus,
               createdAt: self.createdAt,
               updatedAt: Date()
           )
       }
   }
   ```

### テスト戦略

1. **単体テスト優先**
   - ドメイン層の純粋関数を先にテスト
   - モックは最小限に使用

2. **テストファーストの実践**
   ```
   1. 失敗するテストを書く
   2. 最小限の実装でテストを通す
   3. リファクタリングする
   4. 次の機能に進む
   ```

3. **リファクタリング指針**
   - 重複の除去
   - 関心事の分離
   - 変更理由の単一化

### ドメインモデリング

1. **値オブジェクトの識別**
   - 同一性が値に基づく（等価比較）
   - 不変性を持つ
   - 自己検証能力を持つ

2. **エンティティの識別**
   - 同一性がIDに基づく（ID比較）
   - 可変だが制御された変更
   - ライフサイクルを持つ

3. **集約の設計**
   - 関連するエンティティのグループ
   - トランザクション境界を形成
   - ルートエンティティを通じてのみアクセス

## 実装例: タスク管理

### 型定義

```swift
// タスクステータス（列挙型）
enum Status: String, Codable {
    case pending = "pending"
    case inProgress = "in-progress"
    case completed = "completed"
}

// IDのための型安全な型
struct TaskId: Hashable, Identifiable, Codable {
    let value: String
    var id: String { value }
    
    private init(_ value: String) {
        self.value = value
    }
    
    static func create(_ value: String) -> Result<TaskId, DomainError> {
        guard !value.isEmpty else {
            return .failure(DomainError.validation("タスクIDは空にできません"))
        }
        return .success(TaskId(value))
    }
    
    static func generateNew() -> TaskId {
        return TaskId(UUID().uuidString)
    }
}

// タスクエンティティ
struct Task: Identifiable, Codable, Equatable {
    let id: TaskId
    let title: String
    let description: String?
    let status: Status
    let createdAt: Date
    let updatedAt: Date
    
    static func ==(lhs: Task, rhs: Task) -> Bool {
        return lhs.id.value == rhs.id.value
    }
}
```

### ドメイン関数

```swift
// タスク作成関数
func createTask(id: TaskId, title: String, description: String? = nil) -> Result<Task, DomainError> {
    guard !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        return .failure(DomainError.validation("タスクのタイトルは必須です"))
    }
    
    let now = Date()
    
    let task = Task(
        id: id,
        title: title,
        description: description,
        status: .pending,
        createdAt: now,
        updatedAt: now
    )
    
    return .success(task)
}

// タスクステータス更新関数
func changeTaskStatus(task: Task, newStatus: Status) -> Result<Task, DomainError> {
    if task.status == .completed && newStatus != .completed {
        return .failure(DomainError.business("完了したタスクは再開できません"))
    }
    
    let updatedTask = Task(
        id: task.id,
        title: task.title,
        description: task.description,
        status: newStatus,
        createdAt: task.createdAt,
        updatedAt: Date()
    )
    
    return .success(updatedTask)
}

// タスク検索関数
func filterTasks(tasks: [Task], status: Status? = nil) -> [Task] {
    if let status = status {
        return tasks.filter { $0.status == status }
    } else {
        return tasks
    }
}
```

### リポジトリ

```swift
// リポジトリインターフェース
protocol TaskRepository {
    func findById(id: TaskId) async -> Result<Task?, DomainError>
    func findAll() async -> Result<[Task], DomainError>
    func save(task: Task) async -> Result<Void, DomainError>
    func remove(id: TaskId) async -> Result<Void, DomainError>
}

// アプリケーションサービス
actor TaskService {
    private let repository: TaskRepository
    
    init(repository: TaskRepository) {
        self.repository = repository
    }
    
    func createTask(title: String, description: String? = nil) async -> Result<Task, DomainError> {
        // IDの生成
        let id = TaskId.generateNew()
        
        // タスクの作成
        let taskResult = createTask(id: id, title: title, description: description)
        guard case .success(let task) = taskResult else {
            return taskResult
        }
        
        // 保存
        let saveResult = await repository.save(task: task)
        guard case .success = saveResult else {
            return .failure(saveResult.error!)
        }
        
        return .success(task)
    }
    
    func updateTaskStatus(id: TaskId, newStatus: Status) async -> Result<Task, DomainError> {
        // タスクの取得
        let findResult = await repository.findById(id: id)
        guard case .success(let maybeTask) = findResult else {
            return .failure(findResult.error!)
        }
        
        guard let task = maybeTask else {
            return .failure(DomainError.notFound("タスク ID: \(id.value) が見つかりません"))
        }
        
        // ステータスの更新
        let updateResult = changeTaskStatus(task: task, newStatus: newStatus)
        guard case .success(let updatedTask) = updateResult else {
            return .failure(updateResult.error!)
        }
        
        // 保存
        let saveResult = await repository.save(task: updatedTask)
        guard case .success = saveResult else {
            return .failure(saveResult.error!)
        }
        
        return .success(updatedTask)
    }
    
    func getTasks(status: Status? = nil) async -> Result<[Task], DomainError> {
        // 全タスクの取得
        let findResult = await repository.findAll()
        guard case .success(let tasks) = findResult else {
            return .failure(findResult.error!)
        }
        
        // フィルタリング
        let filteredTasks = filterTasks(tasks: tasks, status: status)
        return .success(filteredTasks)
    }
}
```

### テスト

```swift
import XCTest
@testable import MyApp

final class TaskTests: XCTestCase {
    
    func testCreateTask_ValidTitle_ReturnsTask() {
        // Arrange
        let id = TaskId.generateNew()
        
        // Act
        let result = createTask(id: id, title: "テストタスク")
        
        // Assert
        XCTAssertTrue(result.isSuccess)
        if case .success(let task) = result {
            XCTAssertEqual(task.title, "テストタスク")
            XCTAssertEqual(task.status, .pending)
        }
    }
    
    func testCreateTask_EmptyTitle_ReturnsError() {
        // Arrange
        let id = TaskId.generateNew()
        
        // Act
        let result = createTask(id: id, title: "")
        
        // Assert
        XCTAssertTrue(result.isFailure)
        if case .failure(let error as DomainError) = result {
            XCTAssertEqual(error.errorDescription, "バリデーションエラー: タスクのタイトルは必須です")
        }
    }
    
    func testChangeTaskStatus_ValidStatusChange_ReturnsUpdatedTask() {
        // Arrange
        let id = TaskId.generateNew()
        let taskResult = createTask(id: id, title: "テストタスク")
        guard case .success(let task) = taskResult else {
            XCTFail("タスク作成に失敗")
            return
        }
        
        // Act
        let result = changeTaskStatus(task: task, newStatus: .inProgress)
        
        // Assert
        XCTAssertTrue(result.isSuccess)
        if case .success(let updatedTask) = result {
            XCTAssertEqual(updatedTask.status, .inProgress)
            XCTAssertEqual(updatedTask.title, task.title)
            XCTAssertEqual(updatedTask.id.value, task.id.value)
        }
    }
    
    func testChangeTaskStatus_ReactivateCompletedTask_ReturnsError() {
        // Arrange
        let id = TaskId.generateNew()
        
        // 完了状態のタスクを作成
        let taskResult = createTask(id: id, title: "テストタスク")
        guard case .success(var task) = taskResult else {
            XCTFail("タスク作成に失敗")
            return
        }
        
        let completeResult = changeTaskStatus(task: task, newStatus: .completed)
        guard case .success(let completedTask) = completeResult else {
            XCTFail("タスク完了に失敗")
            return
        }
        
        // Act
        let result = changeTaskStatus(task: completedTask, newStatus: .inProgress)
        
        // Assert
        XCTAssertTrue(result.isFailure)
        if case .failure(let error as DomainError) = result {
            XCTAssertEqual(error.errorDescription, "ビジネスルールエラー: 完了したタスクは再開できません")
        }
    }
}
```

## 実践のポイント

1. **小さく始める**
   - 複雑なドメインモデルから始めない
   - 基本的な値オブジェクトから実装

2. **段階的に発展させる**
   - 必要に応じて複雑さを追加
   - 過剰な抽象化を避ける

3. **フィードバックを得る**
   - 頻繁にテストを実行
   - コード品質を継続的に評価

4. **リファクタリングを恐れない**
   - テストの保護下で安全に改善
   - 徐々により良いモデルへ進化させる

## 注意点

- 過度に複雑なモデリングは避ける
- プロジェクト規模に合わせたアプローチを選択
- 型システムの限界を理解する
- テストのメンテナンスコストを考慮する
- Swiftの値型と参照型の違いを意識する（構造体はコピーされる）

## まとめ

DDD、TDD、FPを組み合わせることで、型安全で保守性の高いコードを段階的に開発できます。Swiftの値型中心のアプローチは関数型プログラミングの不変性の原則と自然に適合し、特に値オブジェクトの実装に適しています。

Swiftの強み：
- 値型（構造体）による不変データモデルの実装
- 強力な型システムによるコンパイル時の安全性チェック
- プロトコル指向プログラミングによる柔軟なインターフェース設計
- 標準ライブラリに組み込まれたResult型
- 非同期処理の明示的な表現（async/await）

プロジェクトの規模や要件に応じて、完全なDDDアプローチと軽量アプローチを使い分けることで、効率的な開発が可能になります。
