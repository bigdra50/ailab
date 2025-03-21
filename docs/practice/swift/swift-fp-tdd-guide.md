# テスト駆動開発と関数型ドメインモデリング実践ガイド

このドキュメントでは、テスト駆動開発（TDD）、関数型ドメインモデリング、およびアダプターパターンをSwiftで実装する実践的なアプローチを解説します。

## 基本理念

- **関数型アプローチ**:
  オブジェクト指向ではなく関数型プログラミングの原則に基づいてドメインモデルを設計
- **テスト駆動開発**: 「Red-Green-Refactor」サイクルに従ってコードを段階的に実装
- **アダプターパターン**: 外部依存を抽象化し、ビジネスロジックを独立させる
- **不変性の重視**:
  値型と`let`による不変データ構造を活用し、変更が必要な場合は新しいインスタンスを作成

## 実装構造

```
MyApp/
├── Core/                  # コアユーティリティ
│   └── Result+Extensions.swift  # Result型の拡張
├── Domain/                # ドメインレイヤー
│   ├── Models/            # 基本型定義
│   ├── ValueObjects/      # 値オブジェクト
│   ├── Entities/          # エンティティ
│   ├── Repositories/      # リポジトリインターフェース
│   └── Services/          # ドメインサービス
├── Application/           # アプリケーションレイヤー
│   └── Services/          # アプリケーションサービス
└── Infrastructure/        # インフラストラクチャレイヤー
    └── Repositories/      # リポジトリの実装
```

## 1. 型とResult型の定義

### エラー型の定義

```swift
// Core/Errors.swift
enum ValidationError: Error, LocalizedError {
    case invalid(String)
    
    init(_ message: String) {
        self = .invalid(message)
    }
    
    var errorDescription: String? {
        switch self {
        case .invalid(let message):
            return "バリデーションエラー: \(message)"
        }
    }
}

enum DomainError: Error, LocalizedError {
    case notFound(entityName: String, id: String)
    case system(String)
    
    var errorDescription: String? {
        switch self {
        case .notFound(let entity, let id):
            return "\(entity) ID: \(id) が見つかりません"
        case .system(let message):
            return "システムエラー: \(message)"
        }
    }
}
```

### Result型の拡張

```swift
// Core/Result+Extensions.swift
extension Result {
    // 複数のResultを組み合わせる
    static func combine<T>(_ results: [Result<T, Failure>]) -> Result<[T], Failure> {
        var successes = [T]()
        
        for result in results {
            switch result {
            case .success(let value):
                successes.append(value)
            case .failure(let error):
                return .failure(error)
            }
        }
        
        return .success(successes)
    }
    
    // isSuccessとisFailureのプロパティを追加
    var isSuccess: Bool {
        switch self {
        case .success: return true
        case .failure: return false
        }
    }
    
    var isFailure: Bool {
        return !isSuccess
    }
}
```

### エンティティID型の定義

```swift
// Domain/Models/EntityId.swift
struct EntityId: Hashable, Identifiable, Codable {
    let value: String
    var id: String { value }
    
    // プライベートイニシャライザで安全な作成を強制
    private init(_ value: String) {
        self.value = value
    }
    
    // ファクトリメソッドでバリデーション
    static func create(_ value: String) -> Result<EntityId, ValidationError> {
        guard !value.isEmpty else {
            return .failure(ValidationError("IDは空にできません"))
        }
        return .success(EntityId(value))
    }
    
    // UUID生成用ファクトリメソッド
    static func generateNew() -> EntityId {
        return EntityId(UUID().uuidString)
    }
}
```

## 2. テスト駆動開発による実装プロセス

### ステップ1: 仕様をテストとして記述する

「テストは仕様である」という考え方に基づき、実装前に期待する動作をテストとして記述します。

```swift
// Tests/ValueObjects/MoneyTests.swift
import XCTest
@testable import MyApp

final class MoneyTests: XCTestCase {
    
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
        if case .failure(let error as ValidationError) = result {
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
    
    func testSubtractMoney_InvalidSubtraction_ReturnsError() {
        // Arrange
        let money1 = try! Money.create(amount: 50).get()
        let money2 = try! Money.create(amount: 100).get()
        
        // Act
        let result = money1.subtract(money2)
        
        // Assert
        XCTAssertTrue(result.isFailure)
        if case .failure(let error as ValidationError) = result {
            XCTAssertEqual(error.errorDescription, "バリデーションエラー: 金額の減算結果が負の値になりました")
        }
    }
}
```

### ステップ2: 最小限の実装を行う

テストが失敗する状態から始め、テストがパスするための最小限の実装を行います。

```swift
// Domain/ValueObjects/Money.swift
struct Money: Codable {
    let amount: Int
    
    private init(amount: Int) {
        self.amount = amount
    }
    
    static func create(amount: Int) -> Result<Money, ValidationError> {
        if amount < 0 {
            return .failure(ValidationError("金額は0以上である必要があります"))
        }
        
        return .success(Money(amount: amount))
    }
}
```

### ステップ3: リファクタリングを行う

テストが通った後、コードをリファクタリングして品質を向上させます。

```swift
// Domain/ValueObjects/Money.swift (リファクタリング後)
struct Money: Equatable, Codable {
    let amount: Int
    
    // プライベートイニシャライザ
    private init(amount: Int) {
        self.amount = amount
    }
    
    // ファクトリメソッド
    static func create(amount: Int) -> Result<Money, ValidationError> {
        guard amount >= 0 else {
            return .failure(ValidationError("金額は0以上である必要があります"))
        }
        
        return .success(Money(amount: amount))
    }
    
    // 操作関数
    func add(_ other: Money) -> Money {
        return Money(amount: self.amount + other.amount)
    }
    
    func subtract(_ other: Money) -> Result<Money, ValidationError> {
        let newAmount = self.amount - other.amount
        
        guard newAmount >= 0 else {
            return .failure(ValidationError("金額の減算結果が負の値になりました"))
        }
        
        return .success(Money(amount: newAmount))
    }
    
    // フォーマット
    func format() -> String {
        return "¥\(amount.formatted())"
    }
}
```

## 3. 値オブジェクトの実装パターン

値オブジェクトは以下の特性を持ちます：

1. **不変性**: 一度作成されたら変更されない
2. **等価性**: 内部の値が同じなら等価とみなされる
3. **自己検証**: 常に有効な状態を保つ
4. **意味のある操作**: ドメインにおける意味のある操作を提供

### メールアドレス値オブジェクトの実装例

```swift
// Domain/ValueObjects/EmailAddress.swift
struct EmailAddress: Equatable, Codable {
    let value: String
    
    private init(value: String) {
        self.value = value
    }
    
    static func create(_ value: String) -> Result<EmailAddress, ValidationError> {
        // 簡易的なメールアドレスバリデーション
        let pattern = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
        let predicate = NSPredicate(format: "SELF MATCHES %@", pattern)
        
        guard !value.isEmpty else {
            return .failure(ValidationError("メールアドレスは空にできません"))
        }
        
        guard predicate.evaluate(with: value) else {
            return .failure(ValidationError("有効なメールアドレス形式ではありません"))
        }
        
        return .success(EmailAddress(value: value))
    }
    
    func domain() -> String {
        let components = value.split(separator: "@")
        return components.count > 1 ? String(components[1]) : ""
    }
    
    func username() -> String {
        let components = value.split(separator: "@")
        return components.count > 0 ? String(components[0]) : ""
    }
}
```

## 4. エンティティの実装パターン

エンティティは以下の特性を持ちます：

1. **ID**: 固有の識別子を持つ
2. **不変性**: プロパティの変更ではなく新しいインスタンスを作成
3. **ビジネスルール**: ドメインルールに従った振る舞いを持つ

### 製品エンティティの実装例

```swift
// Domain/Entities/Product.swift
struct Product: Identifiable, Equatable, Codable {
    let id: EntityId
    let name: String
    let price: Money
    let description: String?
    let createdAt: Date
    
    // プライベートイニシャライザ
    private init(id: EntityId, name: String, price: Money, description: String? = nil, createdAt: Date = Date()) {
        self.id = id
        self.name = name
        self.price = price
        self.description = description
        self.createdAt = createdAt
    }
    
    // ファクトリメソッド
    static func create(id: EntityId, name: String, price: Money, description: String? = nil) -> Result<Product, ValidationError> {
        guard !name.isEmpty else {
            return .failure(ValidationError("商品名は必須です"))
        }
        
        return .success(Product(id: id, name: name, price: price, description: description))
    }
    
    // 操作関数 (不変性を保つため新しいインスタンスを返す)
    func changePrice(newPrice: Money) -> Product {
        return Product(id: self.id, name: self.name, price: newPrice, description: self.description, createdAt: self.createdAt)
    }
    
    func updateDescription(newDescription: String?) -> Product {
        return Product(id: self.id, name: self.name, price: self.price, description: newDescription, createdAt: self.createdAt)
    }
    
    func updateName(newName: String) -> Result<Product, ValidationError> {
        guard !newName.isEmpty else {
            return .failure(ValidationError("商品名は必須です"))
        }
        
        return .success(Product(id: self.id, name: newName, price: self.price, description: self.description, createdAt: self.createdAt))
    }
    
    // 判定メソッド
    func isExpensive(threshold: Int = 10000) -> Bool {
        return price.amount >= threshold
    }
}
```

## 5. リポジトリの実装とアダプターパターン

リポジトリはエンティティの永続化を担当し、アダプターパターンを使用して外部依存を抽象化します。

### リポジトリインターフェース

```swift
// Domain/Repositories/ProductRepository.swift
protocol ProductRepository {
    func findById(id: EntityId) async -> Result<Product, DomainError>
    func findAll() async -> Result<[Product], DomainError>
    func save(product: Product) async -> Result<Void, DomainError>
    func remove(id: EntityId) async -> Result<Void, DomainError>
}
```

### インメモリリポジトリ実装（テスト用）

```swift
// Infrastructure/Repositories/InMemoryProductRepository.swift
class InMemoryProductRepository: ProductRepository {
    private var products: [String: Product] = [:]
    
    func findById(id: EntityId) async -> Result<Product, DomainError> {
        guard let product = products[id.value] else {
            return .failure(DomainError.notFound(entityName: "Product", id: id.value))
        }
        
        return .success(product)
    }
    
    func findAll() async -> Result<[Product], DomainError> {
        return .success(Array(products.values))
    }
    
    func save(product: Product) async -> Result<Void, DomainError> {
        products[product.id.value] = product
        return .success(())
    }
    
    func remove(id: EntityId) async -> Result<Void, DomainError> {
        guard products[id.value] != nil else {
            return .failure(DomainError.notFound(entityName: "Product", id: id.value))
        }
        
        products.removeValue(forKey: id.value)
        return .success(())
    }
}
```

### CoreDataリポジトリ実装（実際のアプリケーション用）

```swift
// Infrastructure/Repositories/CoreDataProductRepository.swift
class CoreDataProductRepository: ProductRepository {
    private let context: NSManagedObjectContext
    
    init(context: NSManagedObjectContext) {
        self.context = context
    }
    
    func findById(id: EntityId) async -> Result<Product, DomainError> {
        let request = NSFetchRequest<ProductEntity>(entityName: "ProductEntity")
        request.predicate = NSPredicate(format: "id == %@", id.value)
        request.fetchLimit = 1
        
        do {
            let results = try context.fetch(request)
            guard let entity = results.first else {
                return .failure(DomainError.notFound(entityName: "Product", id: id.value))
            }
            
            return mapToDomainModel(entity)
        } catch {
            return .failure(DomainError.system("データベース検索エラー: \(error.localizedDescription)"))
        }
    }
    
    func findAll() async -> Result<[Product], DomainError> {
        let request = NSFetchRequest<ProductEntity>(entityName: "ProductEntity")
        
        do {
            let results = try context.fetch(request)
            var products: [Product] = []
            var errors: [DomainError] = []
            
            for entity in results {
                let result = mapToDomainModel(entity)
                switch result {
                case .success(let product):
                    products.append(product)
                case .failure(let error):
                    errors.append(error)
                }
            }
            
            if !errors.isEmpty {
                return .failure(DomainError.system("一部の製品のマッピングに失敗しました"))
            }
            
            return .success(products)
        } catch {
            return .failure(DomainError.system("データベース検索エラー: \(error.localizedDescription)"))
        }
    }
    
    func save(product: Product) async -> Result<Void, DomainError> {
        do {
            // 既存のエンティティを検索
            let request = NSFetchRequest<ProductEntity>(entityName: "ProductEntity")
            request.predicate = NSPredicate(format: "id == %@", product.id.value)
            request.fetchLimit = 1
            
            let results = try context.fetch(request)
            let entity: ProductEntity
            
            if let existingEntity = results.first {
                // 既存エンティティの更新
                entity = existingEntity
            } else {
                // 新規エンティティの作成
                entity = ProductEntity(context: context)
                entity.id = product.id.value
            }
            
            // プロパティの設定
            entity.name = product.name
            entity.price = Int64(product.price.amount)
            entity.productDescription = product.description
            entity.createdAt = product.createdAt
            
            try context.save()
            return .success(())
        } catch {
            return .failure(DomainError.system("データベース保存エラー: \(error.localizedDescription)"))
        }
    }
    
    func remove(id: EntityId) async -> Result<Void, DomainError> {
        do {
            let request = NSFetchRequest<ProductEntity>(entityName: "ProductEntity")
            request.predicate = NSPredicate(format: "id == %@", id.value)
            request.fetchLimit = 1
            
            let results = try context.fetch(request)
            guard let entity = results.first else {
                return .failure(DomainError.notFound(entityName: "Product", id: id.value))
            }
            
            context.delete(entity)
            try context.save()
            return .success(())
        } catch {
            return .failure(DomainError.system("データベース削除エラー: \(error.localizedDescription)"))
        }
    }
    
    // CoreDataエンティティからドメインモデルへのマッピング
    private func mapToDomainModel(_ entity: ProductEntity) -> Result<Product, DomainError> {
        guard let idResult = EntityId.create(entity.id ?? "") else {
            return .failure(DomainError.system("無効なID: \(String(describing: entity.id))"))
        }
        
        return idResult.flatMap { id in
            let moneyResult = Money.create(amount: Int(entity.price))
            
            return moneyResult.flatMap { money in
                Product.create(
                    id: id,
                    name: entity.name ?? "",
                    price: money,
                    description: entity.productDescription
                )
            }
        }
    }
}
```

## 6. アプリケーションサービスの実装

アプリケーションサービスはドメインの機能を組み合わせてユースケースを実装します。

```swift
// Application/Services/ProductService.swift
actor ProductService {
    private let repository: ProductRepository
    
    init(repository: ProductRepository) {
        self.repository = repository
    }
    
    func createNewProduct(name: String, amount: Int, description: String? = nil) async -> Result<Product, Error> {
        // IDの生成
        let id = EntityId.generateNew()
        
        // 値オブジェクトの作成
        let moneyResult = Money.create(amount: amount)
        
        return moneyResult.flatMap { money in
            // エンティティの作成
            Product.create(id: id, name: name, price: money, description: description)
        }.flatMap { product in
            // 永続化
            Task {
                await self.repository.save(product: product).map { _ in product }
            }.value
        }
    }
    
    func updateProductPrice(id: EntityId, newAmount: Int) async -> Result<Product, Error> {
        // 製品の取得
        let productResult = await repository.findById(id: id)
        
        // 新しい価格の作成
        let moneyResult = Money.create(amount: newAmount)
        
        // 製品と価格の両方が有効なら更新処理
        return productResult.flatMap { product in
            moneyResult.flatMap { money in
                // 価格を更新した新しい製品を作成
                let updatedProduct = product.changePrice(newPrice: money)
                
                // 更新した製品を保存
                return Task {
                    await self.repository.save(product: updatedProduct).map { _ in updatedProduct }
                }.value
            }
        }
    }
    
    func getAllProducts() async -> Result<[Product], DomainError> {
        return await repository.findAll()
    }
    
    func getProductById(id: EntityId) async -> Result<Product, DomainError> {
        return await repository.findById(id: id)
    }
    
    func deleteProduct(id: EntityId) async -> Result<Void, DomainError> {
        return await repository.remove(id: id)
    }
    
    func searchProductsByName(query: String) async -> Result<[Product], DomainError> {
        return await repository.findAll().map { products in
            products.filter { $0.name.lowercased().contains(query.lowercased()) }
        }
    }
    
    func getProductsInPriceRange(min: Int, max: Int) async -> Result<[Product], Error> {
        let minMoneyResult = Money.create(amount: min)
        let maxMoneyResult = Money.create(amount: max)
        
        return Result.combine([minMoneyResult, maxMoneyResult]).flatMap { moneys in
            let minMoney = moneys[0]
            let maxMoney = moneys[1]
            
            return await repository.findAll().map { products in
                products.filter { product in
                    product.price.amount >= minMoney.amount && 
                    product.price.amount <= maxMoney.amount
                }
            }
        }
    }
}
```

## 7. テスト戦略

テストはレイヤーごとに異なるアプローチで実施します：

### 値オブジェクトとエンティティのテスト

- 純粋な単体テスト
- 外部依存なし
- すべての条件分岐をテスト

```swift
// Tests/Entities/ProductTests.swift
import XCTest
@testable import MyApp

final class ProductTests: XCTestCase {
    
    // テスト用のヘルパー
    private func createValidMoney() -> Money {
        return try! Money.create(amount: 1000).get()
    }
    
    private func createValidId() -> EntityId {
        return EntityId.generateNew()
    }
    
    func testCreateProduct_ValidData_ReturnsProduct() {
        // Arrange
        let id = createValidId()
        let money = createValidMoney()
        
        // Act
        let result = Product.create(id: id, name: "テスト商品", price: money)
        
        // Assert
        XCTAssertTrue(result.isSuccess)
        if case .success(let product) = result {
            XCTAssertEqual(product.id.value, id.value)
            XCTAssertEqual(product.name, "テスト商品")
            XCTAssertEqual(product.price.amount, 1000)
        }
    }
    
    func testCreateProduct_EmptyName_ReturnsError() {
        // Arrange
        let id = createValidId()
        let money = createValidMoney()
        
        // Act
        let result = Product.create(id: id, name: "", price: money)
        
        // Assert
        XCTAssertTrue(result.isFailure)
        if case .failure(let error as ValidationError) = result {
            XCTAssertEqual(error.errorDescription, "バリデーションエラー: 商品名は必須です")
        }
    }
    
    func testChangePrice_ValidPrice_ReturnsUpdatedProduct() {
        // Arrange
        let product = try! Product.create(
            id: createValidId(),
            name: "テスト商品",
            price: createValidMoney()
        ).get()
        
        let newMoney = try! Money.create(amount: 2000).get()
        
        // Act
        let updatedProduct = product.changePrice(newPrice: newMoney)
        
        // Assert
        XCTAssertEqual(updatedProduct.price.amount, 2000)
        XCTAssertEqual(updatedProduct.name, product.name)
        XCTAssertEqual(updatedProduct.id.value, product.id.value)
    }
    
    func testUpdateName_ValidName_ReturnsUpdatedProduct() {
        // Arrange
        let product = try! Product.create(
            id: createValidId(),
            name: "テスト商品",
            price: createValidMoney()
        ).get()
        
        // Act
        let result = product.updateName(newName: "更新商品")
        
        // Assert
        XCTAssertTrue(result.isSuccess)
        if case .success(let updatedProduct) = result {
            XCTAssertEqual(updatedProduct.name, "更新商品")
            XCTAssertEqual(updatedProduct.price.amount, product.price.amount)
            XCTAssertEqual(updatedProduct.id.value, product.id.value)
        }
    }
    
    func testUpdateName_EmptyName_ReturnsError() {
        // Arrange
        let product = try! Product.create(
            id: createValidId(),
            name: "テスト商品",
            price: createValidMoney()
        ).get()
        
        // Act
        let result = product.updateName(newName: "")
        
        // Assert
        XCTAssertTrue(result.isFailure)
        if case .failure(let error as ValidationError) = result {
            XCTAssertEqual(error.errorDescription, "バリデーションエラー: 商品名は必須です")
        }
    }
    
    func testIsExpensive_PriceBelowThreshold_ReturnsFalse() {
        // Arrange
        let product = try! Product.create(
            id: createValidId(),
            name: "安い商品",
            price: try! Money.create(amount: 5000).get()
        ).get()
        
        // Act & Assert
        XCTAssertFalse(product.isExpensive())
    }
    
    func testIsExpensive_PriceAboveThreshold_ReturnsTrue() {
        // Arrange
        let product = try! Product.create(
            id: createValidId(),
            name: "高い商品",
            price: try! Money.create(amount: 15000).get()
        ).get()
        
        // Act & Assert
        XCTAssertTrue(product.isExpensive())
    }
}
```

### リポジトリのテスト

- インメモリ実装を使用した統合テスト

```swift
// Tests/Repositories/InMemoryProductRepositoryTests.swift
import XCTest
@testable import MyApp

final class InMemoryProductRepositoryTests: XCTestCase {
    
    var repository: InMemoryProductRepository!
    var testProduct: Product!
    var testId: EntityId!
    
    override func setUp() async throws {
        repository = InMemoryProductRepository()
        testId = EntityId.generateNew()
        let money = try Money.create(amount: 1000).get()
        testProduct = try Product.create(id: testId, name: "テスト商品", price: money).get()
    }
    
    func testSaveAndFindById() async {
        // Arrange & Act
        let saveResult = await repository.save(product: testProduct)
        let findResult = await repository.findById(id: testId)
        
        // Assert
        XCTAssertTrue(saveResult.isSuccess)
        XCTAssertTrue(findResult.isSuccess)
        
        if case .success(let product) = findResult {
            XCTAssertEqual(product.id.value, testProduct.id.value)
            XCTAssertEqual(product.name, testProduct.name)
            XCTAssertEqual(product.price.amount, testProduct.price.amount)
        }
    }
    
    func testFindById_NonExistentId_ReturnsError() async {
        // Arrange
        let nonExistentId = EntityId.generateNew()
        
        // Act
        let result = await repository.findById(id: nonExistentId)
        
        // Assert
        XCTAssertTrue(result.isFailure)
        if case .failure(let error as DomainError) = result {
            switch error {
            case .notFound(let entity, let id):
                XCTAssertEqual(entity, "Product")
                XCTAssertEqual(id, nonExistentId.value)
            default:
                XCTFail("予期しないエラー: \(error)")
            }
        }
    }
    
    func testFindAll_EmptyRepository_ReturnsEmptyArray() async {
        // Act
        let result = await repository.findAll()
        
        // Assert
        XCTAssertTrue(result.isSuccess)
        if case .success(let products) = result {
            XCTAssertEqual(products.count, 0)
        }
    }
    
    func testFindAll_WithProducts_ReturnsAllProducts() async {
        // Arrange
        let money1 = try! Money.create(amount: 1000).get()
        let money2 = try! Money.create(amount: 2000).get()
        
        let product1 = try! Product.create(id: EntityId.generateNew(), name: "商品1", price: money1).get()
        let product2 = try! Product.create(id: EntityId.generateNew(), name: "商品2", price: money2).get()
        
        // Act
        let save1Result = await repository.save(product: product1)
        let save2Result = await repository.save(product: product2)
        let findAllResult = await repository.findAll()
        
        // Assert
        XCTAssertTrue(save1Result.isSuccess)
        XCTAssertTrue(save2Result.isSuccess)
        XCTAssertTrue(findAllResult.isSuccess)
        
        if case .success(let products) = findAllResult {
            XCTAssertEqual(products.count, 2)
            
            // ID値で製品をソートして検証
            let sortedProducts = products.sorted { $0.name < $1.name }
            XCTAssertEqual(sortedProducts[0].name, "商品1")
            XCTAssertEqual(sortedProducts[1].name, "商品2")
        }
    }
    
    func testRemove_ExistingProduct_RemovesSuccessfully() async {
        // Arrange
        let saveResult = await repository.save(product: testProduct)
        XCTAssertTrue(saveResult.isSuccess)
        
        // Act
        let removeResult = await repository.remove(id: testId)
        let findResult = await repository.findById(id: testId)
        
        // Assert
        XCTAssertTrue(removeResult.isSuccess)
        XCTAssertTrue(findResult.isFailure)
    }
    
    func testRemove_NonExistentProduct_ReturnsError() async {
        // Arrange
        let nonExistentId = EntityId.generateNew()
        
        // Act
        let result = await repository.remove(id: nonExistentId)
        
        // Assert
        XCTAssertTrue(result.isFailure)
        if case .failure(let error as DomainError) = result {
            switch error {
            case .notFound(let entity, let id):
                XCTAssertEqual(entity, "Product")
                XCTAssertEqual(id, nonExistentId.value)
            default:
                XCTFail("予期しないエラー: \(error)")
            }
        }
    }
}
```

### アプリケーションサービスのテスト

- モック/スタブを使用した単体テスト

```swift
// Tests/Services/ProductServiceTests.swift
import XCTest
@testable import MyApp

final class ProductServiceTests: XCTestCase {
    
    var repository: InMemoryProductRepository!
    var service: ProductService!
    
    override func setUp() async throws {
        repository = InMemoryProductRepository()
        service = ProductService(repository: repository)
    }
    
    func testCreateNewProduct_ValidData_CreatesAndReturnsProduct() async {
        // Arrange & Act
        let result = await service.createNewProduct(name: "新商品", amount: 1500)
        
        // Assert
        XCTAssertTrue(result.isSuccess)
        if case .success(let product) = result {
            XCTAssertEqual(product.name, "新商品")
            XCTAssertEqual(product.price.amount, 1500)
            
            // リポジトリに保存されていることを確認
            let findResult = await repository.findById(id: product.id)
            XCTAssertTrue(findResult.isSuccess)
        }
    }
    
    func testCreateNewProduct_InvalidAmount_ReturnsError() async {
        // Arrange & Act
        let result = await service.createNewProduct(name: "商品", amount: -100)
        
        // Assert
        XCTAssertTrue(result.isFailure)
        if case .failure(let error as ValidationError) = result {
            XCTAssertEqual(error.errorDescription, "バリデーションエラー: 金額は0以上である必要があります")
        }
    }
    
    func testCreateNewProduct_EmptyName_ReturnsError() async {
        // Arrange & Act
        let result = await service.createNewProduct(name: "", amount: 1000)
        
        // Assert
        XCTAssertTrue(result.isFailure)
        if case .failure(let error as ValidationError) = result {
            XCTAssertEqual(error.errorDescription, "バリデーションエラー: 商品名は必須です")
        }
    }
    
    func testUpdateProductPrice_ExistingProduct_UpdatesPrice() async {
        // Arrange
        let createResult = await service.createNewProduct(name: "テスト商品", amount: 1000)
        XCTAssertTrue(createResult.isSuccess)
        
        var product: Product!
        if case .success(let p) = createResult {
            product = p
        } else {
            XCTFail("商品の作成に失敗")
            return
        }
        
        // Act
        let updateResult = await service.updateProductPrice(id: product.id, newAmount: 2000)
        
        // Assert
        XCTAssertTrue(updateResult.isSuccess)
        if case .success(let updatedProduct) = updateResult {
            XCTAssertEqual(updatedProduct.price.amount, 2000)
            XCTAssertEqual(updatedProduct.name, product.name)
            XCTAssertEqual(updatedProduct.id.value, product.id.value)
            
            // リポジトリに更新が反映されていることを確認
            let findResult = await repository.findById(id: product.id)
            XCTAssertTrue(findResult.isSuccess)
            if case .success(let savedProduct) = findResult {
                XCTAssertEqual(savedProduct.price.amount, 2000)
            }
        }
    }
    
    func testUpdateProductPrice_NonExistentProduct_ReturnsError() async {
        // Arrange
        let nonExistentId = EntityId.generateNew()
        
        // Act
        let result = await service.updateProductPrice(id: nonExistentId, newAmount: 2000)
        
        // Assert
        XCTAssertTrue(result.isFailure)
        if case .failure(let error as DomainError) = result {
            switch error {
            case .notFound(let entity, let id):
                XCTAssertEqual(entity, "Product")
                XCTAssertEqual(id, nonExistentId.value)
            default:
                XCTFail("予期しないエラー: \(error)")
            }
        }
    }
    
    func testGetProductsInPriceRange_ReturnsFilteredProducts() async {
        // Arrange
        let createResult1 = await service.createNewProduct(name: "安い商品", amount: 500)
        let createResult2 = await service.createNewProduct(name: "中間商品", amount: 1500)
        let createResult3 = await service.createNewProduct(name: "高い商品", amount: 3000)
        
        XCTAssertTrue(createResult1.isSuccess)
        XCTAssertTrue(createResult2.isSuccess)
        XCTAssertTrue(createResult3.isSuccess)
        
        // Act
        let result = await service.getProductsInPriceRange(min: 1000, max: 2000)
        
        // Assert
        XCTAssertTrue(result.isSuccess)
        if case .success(let products) = result {
            XCTAssertEqual(products.count, 1)
            XCTAssertEqual(products[0].name, "中間商品")
        }
    }
    
    func testSearchProductsByName_ReturnsMatchingProducts() async {
        // Arrange
        let createResult1 = await service.createNewProduct(name: "アップル", amount: 500)
        let createResult2 = await service.createNewProduct(name: "オレンジ", amount: 300)
        let createResult3 = await service.createNewProduct(name: "アップルパイ", amount: 800)
        
        XCTAssertTrue(createResult1.isSuccess)
        XCTAssertTrue(createResult2.isSuccess)
        XCTAssertTrue(createResult3.isSuccess)
        
        // Act
        let result = await service.searchProductsByName(query: "アップル")
        
        // Assert
        XCTAssertTrue(result.isSuccess)
        if case .success(let products) = result {
            XCTAssertEqual(products.count, 2)
            let productNames = products.map { $0.name }.sorted()
            XCTAssertEqual(productNames, ["アップル", "アップルパイ"])
        }
    }
}
```

## 8. リファクタリングガイドライン

TDDの「リファクタリング」フェーズでは以下の点に注意します：

- **単一責任の原則**: 各関数は一つの責任のみを持つようにする
- **不変性の維持**: 状態変更ではなく新しいインスタンスを返す
- **pure関数の優先**: 可能な限り副作用のない純粋関数として実装する
- **ビジネスルールの集約**: 関連するルールは同じ場所に集める
- **適切な抽象化**: 過度な抽象化や早すぎる抽象化を避ける
- **命名の改善**: よりドメインに即した命名に改善する

### リファクタリング例：値オブジェクトのロジック改善

**リファクタリング前**:
```swift
func subtract(_ other: Money) -> Result<Money, ValidationError> {
    let newAmount = self.amount - other.amount
    
    if newAmount < 0 {
        return .failure(ValidationError("金額の減算結果が負の値になりました"))
    }
    
    return .success(Money(amount: newAmount))
}
```

**リファクタリング後**:
```swift
func subtract(_ other: Money) -> Result<Money, ValidationError> {
    let newAmount = self.amount - other.amount
    
    guard newAmount >= 0 else {
        return .failure(ValidationError("金額の減算結果が負の値になりました"))
    }
    
    return .success(Money(amount: newAmount))
}

// 安全な減算（負の値にならない場合のみ）
func safeSubtract(_ other: Money) -> Money? {
    let newAmount = self.amount - other.amount
    return newAmount >= 0 ? Money(amount: newAmount) : nil
}

// 比較関数の追加
func isGreaterThan(_ other: Money) -> Bool {
    return self.amount > other.amount
}

func isLessThan(_ other: Money) -> Bool {
    return self.amount < other.amount
}
```

### リファクタリング例：ドメインロジックの分離

**リファクタリング前**:
```swift
func isExpensive(threshold: Int = 10000) -> Bool {
    return price.amount >= threshold
}
```

**リファクタリング後**:
```swift
// PriceCategory 値オブジェクトの導入
enum PriceCategory {
    case budget
    case standard
    case premium
    case luxury
    
    static func categorize(money: Money) -> PriceCategory {
        let amount = money.amount
        
        switch amount {
        case 0..<5000:
            return .budget
        case 5000..<10000:
            return .standard
        case 10000..<50000:
            return .premium
        default:
            return .luxury
        }
    }
    
    var description: String {
        switch self {
        case .budget: return "予算価格"
        case .standard: return "標準価格"
        case .premium: return "プレミアム価格"
        case .luxury: return "高級価格"
        }
    }
}

// Product拡張
extension Product {
    var priceCategory: PriceCategory {
        return PriceCategory.categorize(money: self.price)
    }
    
    func isInCategory(_ category: PriceCategory) -> Bool {
        return self.priceCategory == category
    }
}
```

## まとめ

関数型アプローチによるドメイン駆動設計は、不変性と型安全性を強調しながらビジネスドメインをモデル化する強力なパラダイムです。テスト駆動開発と組み合わせることで、高品質なコードと明確な仕様の両方を実現できます。

Swiftによる実装の主な利点：

1. **値型の活用**: Swiftの構造体（値型）は不変データモデルの実装に最適
2. **型安全性**: コンパイル時に多くのエラーを捉えられる
3. **関数型プログラミングのサポート**: Swiftは高階関数やパターンマッチングなど関数型の機能をサポート
4. **テストのしやすさ**: 純粋関数は容易にテスト可能
5. **非同期処理の明示性**: Swift Concurrencyによる非同期処理の明示的な表現
6. **関心の分離**: 各レイヤーとコンポーネントが明確に分離される
7. **メンテナンス性**: 不変データ構造と明示的な依存関係により理解しやすい
8. **SwiftUIとの親和性**: 関数型パラダイムはSwiftUIの宣言型UIと相性が良い

この実践ガイドで示したアプローチは、特にiOSやmacOSアプリケーション開発において、保守性の高い堅牢なコードの実現に役立つでしょう。値オブジェクト、エンティティ、リポジトリ、サービスの適切な分離と連携により、複雑なビジネスロジックを扱うアプリケーションでも、テスト可能でスケーラブルな実装が可能になります。
