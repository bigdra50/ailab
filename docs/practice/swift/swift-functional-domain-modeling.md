# 関数型ドメインモデリング（Functional Domain Modeling）

## 目次

1. [関数型ドメインモデリングとは](#1-関数型ドメインモデリングとは)
2. [関数型プログラミングとDDDの融合](#2-関数型プログラミングとdddの融合)
3. [Swiftにおける関数型ドメインモデリング](#3-swiftにおける関数型ドメインモデリング)
4. [主要な実装パターン](#4-主要な実装パターン)
5. [オニオンアーキテクチャとの組み合わせ](#5-オニオンアーキテクチャとの組み合わせ)
6. [メリットとデメリット](#6-メリットとデメリット)
7. [実装例](#7-実装例)
8. [参考リソース](#8-参考リソース)

## 1. 関数型ドメインモデリングとは

関数型ドメインモデリングは、ドメイン駆動設計（DDD）の考え方を関数型プログラミング（FP）のパラダイムで実現するアプローチです。Scott
Wlashinの著書「Domain Modeling Made
Functional」で体系化された方法論で、以下の特徴があります：

### 1.1 基本概念

- **ドメインロジックを型と関数で表現する**：
  - ビジネスプロセスをワークフローとして純粋関数で表現
  - データ構造をイミュータブルな型で表現
  - 代数的データ型（ADT）を活用したモデリング

- **型駆動開発（Type Driven Development）**：
  - 型を先に設計し、それに導かれる形で実装を進める
  - 「不正な状態を表現できないようにする」（make illegal states
    unrepresentable）

- **イミュータブル**：
  - 状態の変更ではなく、状態遷移を関数適用として表現
  - オブジェクトは変更せず、新しいオブジェクトを返す

### 1.2 従来のDDDとの違い

従来のオブジェクト指向ベースのDDDと比較した関数型DDDの特徴：

| 側面           | オブジェクト指向DDD              | 関数型DDD                  |
| -------------- | -------------------------------- | -------------------------- |
| 状態管理       | 可変状態（ミュータブル）         | 不変状態（イミュータブル） |
| 振る舞い       | メソッド                         | 純粋関数                   |
| カプセル化     | クラス内部に状態と振る舞いを隠蔽 | 型と関数を明示的に分離     |
| 副作用         | ドメイン内に分散                 | 境界に押し出す             |
| モデリング手法 | クラス図など                     | 型定義と関数シグネチャ     |
| エラー処理     | 例外                             | 型で表現（Result型など）   |

## 2. 関数型プログラミングとDDDの融合

### 2.1 なぜ関数型プログラミングとDDDを組み合わせるのか

1. **型の活用**：
   - 静的型付け言語の利点を最大限に活かす
   - 型によるドメイン知識の表現と検証
   - コンパイル時の型チェックによるエラー検出

2. **保守性の向上**：
   - 副作用を分離し、純粋関数に集中することで予測可能性が高まる
   - イミュータブルな設計により、状態変化に関連する複雑さを減少

3. **テスト容易性**：
   - 純粋関数は入力と出力の関係が明確で、テストが容易
   - 副作用の分離により、ドメインロジックのみをテストできる

### 2.2 関数型DDDの核となる要素

1. **ユビキタス言語の重視**：
   - 型定義を通じて、ドメインの概念を明確に表現
   - プリミティブ型の代わりに、ドメイン固有の型を使用

2. **イベントとワークフローへのフォーカス**：
   - データ構造よりもイベントとワークフローを重視
   - ワークフローをパイプラインとして表現

3. **自然言語ベースのモデリング**：
   - UMLなどのダイアグラムよりも、自然言語を書式化した表現を使用
   - プログラマ以外の関係者と認識を共有しやすい

## 3. Swiftにおける関数型ドメインモデリング

Swiftは値型中心の設計思想と強力な型システムを持ち、関数型プログラミングの要素も多く取り入れているため、関数型ドメインモデリングの実践に非常に適しています。

### 3.1 Swiftでの型表現

Swiftでは以下の機能を使って関数型DDDの型を表現できます：

1. **構造体を使った値オブジェクト**：
   - イミュータブルなドメインオブジェクトの構造を定義
   - 値オブジェクトの表現に最適

```swift
// 値オブジェクトの例
struct Email {
    let value: String
    
    private init(value: String) {
        self.value = value
    }
    
    static func create(_ value: String) -> Result<Email, DomainError> {
        // メールアドレスの検証
        guard value.contains("@"), value.contains(".") else {
            return .failure(DomainError.validation("不正なメールアドレス形式です"))
        }
        return .success(Email(value: value))
    }
}

// ブランド化された型（TypeScriptのbranded typesに相当）
struct CustomerId: Hashable, Identifiable, Codable {
    let value: String
    var id: String { value }
    
    private init(_ value: String) {
        self.value = value
    }
    
    static func create(_ value: String) -> Result<CustomerId, DomainError> {
        guard !value.isEmpty else {
            return .failure(DomainError.validation("顧客IDは空にできません"))
        }
        return .success(CustomerId(value))
    }
    
    static func generateNew() -> CustomerId {
        return CustomerId(UUID().uuidString)
    }
}

// エンティティの例
struct Customer: Identifiable, Equatable {
    let id: CustomerId
    let name: String
    let email: Email
    let archived: Bool
    
    // 状態変更は新しいインスタンスを返す
    func archive() -> Customer {
        return Customer(
            id: self.id,
            name: self.name,
            email: self.email,
            archived: true
        )
    }
}
```

2. **列挙型（enum）による代数的データ型**：
   - Swiftの列挙型は関連値を持てるため、直和型（Sum Type）を表現するのに最適
   - 状態遷移や複数の選択肢を型安全に表現

```swift
// 支払い方法の表現
enum PaymentMethod {
    case creditCard(cardNumber: String, expiryDate: String)
    case bankTransfer(accountNumber: String, bankCode: String)
    case cash
}

// 注文状態の表現
enum OrderStatus {
    case pending
    case paid(paidAt: Date)
    case shipped(shippedAt: Date)
    case delivered(deliveredAt: Date)
    case cancelled(cancelledAt: Date, reason: String)
}
```

3. **プロトコルとジェネリクスによる型抽象化**：
   - 共通のインターフェースを定義
   - 異なる型を統一的に扱う

```swift
// 識別可能なエンティティに対するプロトコル
protocol Entity: Identifiable {
    associatedtype IDType: Hashable
    var id: IDType { get }
}

// リポジトリ操作の抽象化
protocol Repository {
    associatedtype EntityType: Entity
    associatedtype IDType
    
    func findById(id: IDType) async -> Result<EntityType?, DomainError>
    func save(entity: EntityType) async -> Result<Void, DomainError>
}
```

### 3.2 Swiftでの`Result`型と関数合成

Swiftには標準ライブラリに`Result`型が組み込まれており、Railway Oriented Programming（ROP）を実装できます：

```swift
// Result型を返す関数
func validateCustomer(customer: Customer) -> Result<Customer, DomainError> {
    // バリデーションロジック
    guard customer.name.count >= 2 else {
        return .failure(DomainError.validation("名前は2文字以上必要です"))
    }
    return .success(customer)
}

// 関数合成によるワークフロー
func createOrderWorkflow(
    command: CreateOrderCommand,
    customerRepository: CustomerRepository,
    productRepository: ProductRepository
) -> Result<Order, DomainError> {
    // ワークフローをResult型の連鎖として構築
    return validateOrder(command)
        .flatMap { validatedCommand in
            customerRepository.findById(id: validatedCommand.customerId)
                .flatMap { customer in
                    guard let customer = customer else {
                        return .failure(DomainError.notFound("顧客が見つかりません"))
                    }
                    return .success((validatedCommand, customer))
                }
        }
        .flatMap { (validatedCommand, customer) in
            // 商品情報を取得
            getProductDetails(validatedCommand.items, repository: productRepository)
                .map { products in
                    (validatedCommand, customer, products)
                }
        }
        .flatMap { (validatedCommand, customer, products) in
            // 注文エンティティを作成
            createOrderEntity(
                customerId: customer.id,
                products: products,
                status: .pending
            )
        }
}
```

## 4. 主要な実装パターン

### 4.1 イミュータブルな状態遷移

オブジェクトの状態変更を、新しいオブジェクトを返す関数として実装します：

```swift
// × 直接変更するのではなく
func archiveCustomer(customer: inout Customer) {
    customer.archived = true // ミュータブル
}

// ○ 新しいオブジェクトを返す
func archiveCustomer(customer: Customer) -> Customer {
    return Customer(
        id: customer.id,
        name: customer.name,
        email: customer.email,
        archived: true
    )
}

// あるいはメソッドとして実装
extension Customer {
    func archive() -> Customer {
        return Customer(
            id: self.id,
            name: self.name,
            email: self.email, 
            archived: true
        )
    }
}
```

### 4.2 Railway Oriented Programming

エラー処理をResult型を使って、ワークフローを中断せずに流れるように実装します：

```swift
// 関数合成でワークフローを構築
func placeOrderWorkflow(
    command: PlaceOrderCommand,
    customerRepository: CustomerRepository,
    productRepository: ProductRepository,
    orderRepository: OrderRepository
) -> Result<Order, DomainError> {
    return validateOrder(command)
        .flatMap { validCommand -> Result<Order, DomainError> in
            let orderLines = extractOrderLines(validCommand.items)
            return calculateTotal(orderLines)
                .flatMap { total in
                    createOrder(
                        customerId: validCommand.customerId,
                        orderLines: orderLines,
                        total: total
                    )
                }
        }
}
```

### 4.3 型による不正状態の排除

型システムを活用して、不正な状態を表現できないようにします：

```swift
// × 不正な状態が表現可能
struct Email {
    let address: String
    let isValid: Bool // 有効かどうかをbool値で表現
}

// ○ 不正な状態を表現できない
struct Email {
    let value: String
    
    private init(value: String) {
        self.value = value
    }
    
    static func create(_ value: String) -> Result<Email, DomainError> {
        // メールアドレスの検証ロジック
        guard isValidEmailFormat(value) else {
            return .failure(DomainError.validation("不正なメールアドレス形式です"))
        }
        return .success(Email(value: value))
    }
    
    private static func isValidEmailFormat(_ value: String) -> Bool {
        // メールアドレスのバリデーション実装
        let emailRegEx = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
        let emailPred = NSPredicate(format:"SELF MATCHES %@", emailRegEx)
        return emailPred.evaluate(with: value)
    }
}
```

### 4.4 純粋関数と副作用の分離

ドメインロジックを純粋関数として実装し、I/Oなどの副作用を境界に押し出します：

```swift
// 純粋なドメイン関数
func calculateTotalPrice(orderLines: [OrderLine]) -> Money {
    return orderLines.reduce(Money.zero) { sum, line in
        sum.add(line.unitPrice.multiply(line.quantity))
    }
}

// 副作用を含む関数（外部に分離）
actor OrderRepository {
    private let database: Database
    
    init(database: Database) {
        self.database = database
    }
    
    func save(order: Order) async -> Result<Void, DomainError> {
        do {
            try await database.save(order)
            return .success(())
        } catch {
            return .failure(DomainError.persistence("注文の保存に失敗しました: \(error.localizedDescription)"))
        }
    }
}
```

## 5. オニオンアーキテクチャとの組み合わせ

関数型ドメインモデリングは、オニオンアーキテクチャ（クリーンアーキテクチャ）と非常に相性が良いです。

### 5.1 レイヤー構成

1. **ドメイン層**：
   - 純粋関数として実装されたビジネスロジック
   - イミュータブルな型で表現されたドメインオブジェクト
   - 副作用を含まない

```swift
// ドメイン層の例
struct Product: Identifiable, Equatable {
    let id: ProductId
    let name: String
    let price: Money
    let description: String?
    
    func changePrice(newPrice: Money) -> Product {
        return Product(
            id: self.id,
            name: self.name,
            price: newPrice,
            description: self.description
        )
    }
}

enum DomainError: Error {
    case validation(String)
    case notFound(String)
    case persistence(String)
    case system(String)
}
```

2. **アプリケーション層**：
   - ユースケースを実装
   - ドメイン層への依存を注入
   - ワークフローとして実装

```swift
// アプリケーション層の例
struct CreateProductCommand {
    let name: String
    let price: Double
    let description: String?
}

actor ProductService {
    private let repository: ProductRepository
    
    init(repository: ProductRepository) {
        self.repository = repository
    }
    
    func createProduct(command: CreateProductCommand) async -> Result<Product, DomainError> {
        // 値オブジェクトの作成
        let moneyResult = Money.create(command.price)
        guard case .success(let money) = moneyResult else {
            return .failure(moneyResult.failureValue!)
        }
        
        // エンティティの作成
        let id = ProductId.generateNew()
        let productResult = Product.create(
            id: id,
            name: command.name,
            price: money,
            description: command.description
        )
        
        guard case .success(let product) = productResult else {
            return .failure(productResult.failureValue!)
        }
        
        // 永続化
        let saveResult = await repository.save(product: product)
        guard case .success = saveResult else {
            return .failure(saveResult.failureValue!)
        }
        
        return .success(product)
    }
}
```

3. **インフラストラクチャ層**：
   - 永続化、メッセージング、外部APIなど
   - 副作用を含む処理
   - ドメイン層へのアダプター

```swift
// インフラストラクチャ層の例
class CoreDataProductRepository: ProductRepository {
    private let context: NSManagedObjectContext
    
    init(context: NSManagedObjectContext) {
        self.context = context
    }
    
    func findById(id: ProductId) async -> Result<Product?, DomainError> {
        do {
            let request = NSFetchRequest<ProductEntity>(entityName: "ProductEntity")
            request.predicate = NSPredicate(format: "id == %@", id.value)
            request.fetchLimit = 1
            
            let results = try context.fetch(request)
            if let entity = results.first {
                return mapToDomain(entity)
            } else {
                return .success(nil)
            }
        } catch {
            return .failure(DomainError.persistence("検索エラー: \(error.localizedDescription)"))
        }
    }
    
    // 他のメソッド実装...
    
    private func mapToDomain(_ entity: ProductEntity) -> Result<Product?, DomainError> {
        // マッピングロジック
        guard let idString = entity.id,
              let name = entity.name else {
            return .failure(DomainError.persistence("不正なエンティティデータ"))
        }
        
        let idResult = ProductId.create(idString)
        let moneyResult = Money.create(entity.price)
        
        // flatMapを使った合成
        return idResult.flatMap { id in
            moneyResult.map { price in
                Product(
                    id: id,
                    name: name,
                    price: price,
                    description: entity.productDescription
                )
            }
        }
    }
}
```

### 5.2 依存性の注入

Swiftでは依存性を明示的に注入することで、テスト可能性を高めます：

```swift
// 依存性注入の例
protocol ProductRepository {
    func findById(id: ProductId) async -> Result<Product?, DomainError>
    func findAll() async -> Result<[Product], DomainError>
    func save(product: Product) async -> Result<Void, DomainError>
    func remove(id: ProductId) async -> Result<Void, DomainError>
}

// 具体的な実装
class InMemoryProductRepository: ProductRepository {
    private var products: [String: Product] = [:]
    
    func findById(id: ProductId) async -> Result<Product?, DomainError> {
        return .success(products[id.value])
    }
    
    // 他のメソッド実装...
}

// アプリケーションサービスに注入
class Application {
    let productService: ProductService
    
    init(repository: ProductRepository) {
        self.productService = ProductService(repository: repository)
    }
    
    // 本番環境用のセットアップ
    static func setupForProduction(coreDataStack: CoreDataStack) -> Application {
        let repository = CoreDataProductRepository(context: coreDataStack.context)
        return Application(repository: repository)
    }
    
    // テスト用のセットアップ
    static func setupForTesting() -> Application {
        let repository = InMemoryProductRepository()
        return Application(repository: repository)
    }
}
```

## 6. メリットとデメリット

### 6.1 メリット

1. **型安全性の向上**：
   - Swiftの強力な型システムを最大限に活用
   - コンパイル時にエラーを検出
   - 不正な状態を表現できないように設計

2. **テストの簡素化**：
   - 純粋関数は入出力の関係が明確で、テストしやすい
   - 副作用の分離により、モックの必要性が減少
   - 型による検証で一部のユニットテストが不要に

3. **保守性と拡張性の向上**：
   - イミュータブルな設計により副作用が限定され、変更の影響範囲が明確
   - 関数合成によるワークフローは、新しいステップの追加が容易
   - ドメインモデルの変更が型システムによって検証される

4. **ビジネスルールの明示的な表現**：
   - 型と関数シグネチャでビジネスルールを表現
   - ドメインの言語を型システムに落とし込む
   - コードがドキュメントとしても機能

5. **Swiftの値型との親和性**：
   - Swiftの構造体は関数型プログラミングの不変性の原則と自然に適合
   - 列挙型による代数的データ型の表現が簡潔

### 6.2 デメリット

1. **学習曲線**：
   - 関数型プログラミングの概念理解が必要
   - 従来の命令型/オブジェクト指向からの切替えコスト
   - チーム全体での理解と実践が必要

2. **Swiftでの関数合成の制約**：
   - 標準の関数合成演算子がない
   - 関数型言語のような単項関数の組み合わせが冗長になりがち
   - モナディック操作のための専用構文（Haskellの`do`記法やF#の計算式に相当するもの）がない

3. **特定のパターンの実装複雑さ**：
   - Swiftでのモナドパターンの実装が直感的でない場合がある
   - 型推論の限界により、明示的な型アノテーションが必要な場合がある
   - 関数型ライブラリのエコシステムが他の言語ほど充実していない

4. **実行時のオーバーヘッド**：
   - イミュータブルな操作による新オブジェクト生成のコスト
   - 大量のデータを扱う場合のパフォーマンス懸念
   - 関数のネストが深くなった場合のスタックオーバーフローの可能性

## 7. 実装例

Swiftでの関数型ドメインモデリングの実装例として、簡単な注文処理システムを見てみましょう。

### 7.1 ドメインモデル

```swift
// ======= 共通エラー型 =======
enum DomainError: Error, LocalizedError {
    case validation(String)
    case notFound(String)
    case business(String)
    case system(String)
    
    var errorDescription: String? {
        switch self {
        case .validation(let message): return "バリデーションエラー: \(message)"
        case .notFound(let message): return "不明な項目: \(message)"
        case .business(let message): return "ビジネスルールエラー: \(message)"
        case .system(let message): return "システムエラー: \(message)"
        }
    }
}

// ======= 値オブジェクト =======
struct CustomerId: Hashable, Identifiable {
    let value: String
    var id: String { value }
    
    private init(_ value: String) {
        self.value = value
    }
    
    static func create(_ value: String) -> Result<CustomerId, DomainError> {
        guard !value.isEmpty else {
            return .failure(DomainError.validation("顧客IDは空にできません"))
        }
        return .success(CustomerId(value))
    }
    
    static func generateNew() -> CustomerId {
        return CustomerId(UUID().uuidString)
    }
}

struct OrderId: Hashable, Identifiable {
    let value: String
    var id: String { value }
    
    private init(_ value: String) {
        self.value = value
    }
    
    static func create(_ value: String) -> Result<OrderId, DomainError> {
        guard !value.isEmpty else {
            return .failure(DomainError.validation("注文IDは空にできません"))
        }
        return .success(OrderId(value))
    }
    
    static func generateNew() -> OrderId {
        return OrderId(UUID().uuidString)
    }
}

struct ProductId: Hashable, Identifiable {
    let value: String
    var id: String { value }
    
    private init(_ value: String) {
        self.value = value
    }
    
    static func create(_ value: String) -> Result<ProductId, DomainError> {
        guard !value.isEmpty else {
            return .failure(DomainError.validation("商品IDは空にできません"))
        }
        return .success(ProductId(value))
    }
}

struct Money: Equatable, Codable {
    let amount: Decimal
    
    private init(amount: Decimal) {
        self.amount = amount
    }
    
    static func create(_ amount: Decimal) -> Result<Money, DomainError> {
        guard amount >= 0 else {
            return .failure(DomainError.validation("金額は0以上である必要があります"))
        }
        return .success(Money(amount: amount))
    }
    
    static func create(_ amount: Double) -> Result<Money, DomainError> {
        return create(Decimal(amount))
    }
    
    static let zero = Money(amount: 0)
    
    func add(_ other: Money) -> Money {
        return Money(amount: self.amount + other.amount)
    }
    
    func subtract(_ other: Money) -> Result<Money, DomainError> {
        let newAmount = self.amount - other.amount
        guard newAmount >= 0 else {
            return .failure(DomainError.validation("残高不足です"))
        }
        return .success(Money(amount: newAmount))
    }
    
    func multiply(_ quantity: Int) -> Money {
        return Money(amount: self.amount * Decimal(quantity))
    }
}

// ======= エンティティ =======
struct OrderLine: Identifiable, Equatable {
    let id: UUID
    let productId: ProductId
    let quantity: Int
    let unitPrice: Money
    
    var totalPrice: Money {
        return unitPrice.multiply(quantity)
    }
    
    init(id: UUID = UUID(), productId: ProductId, quantity: Int, unitPrice: Money) {
        self.id = id
        self.productId = productId
        self.quantity = quantity
        self.unitPrice = unitPrice
    }
}

struct Order: Identifiable {
    let id: OrderId
    let customerId: CustomerId
    let orderLines: [OrderLine]
    let status: OrderStatus
    let totalAmount: Money
    let createdAt: Date
    
    init(id: OrderId, customerId: CustomerId, orderLines: [OrderLine], status: OrderStatus, totalAmount: Money, createdAt: Date = Date()) {
        self.id = id
        self.customerId = customerId
        self.orderLines = orderLines
        self.status = status
        self.totalAmount = totalAmount
        self.createdAt = createdAt
    }
}

// ======= 代数的データ型（直和型） =======
enum OrderStatus {
    case pending
    case paid(paidAt: Date)
    case shipped(shippedAt: Date)
    case delivered(deliveredAt: Date)
    case cancelled(reason: String)
}
```

### 7.2 状態遷移関数

```swift
// 注文ステータスの状態遷移関数
func payOrder(order: Order, paymentDate: Date) -> Result<Order, DomainError> {
    guard case .pending = order.status else {
        return .failure(DomainError.business("準備中の注文のみ支払いできます"))
    }
    
    return .success(Order(
        id: order.id,
        customerId: order.customerId,
        orderLines: order.orderLines,
        status: .paid(paidAt: paymentDate),
        totalAmount: order.totalAmount,
        createdAt: order.createdAt
    ))
}

func shipOrder(order: Order, shipmentDate: Date) -> Result<Order, DomainError> {
    guard case .paid = order.status else {
        return .failure(DomainError.business("支払い済みの注文のみ発送できます"))
    }
    
    return .success(Order(
        id: order.id,
        customerId: order.customerId,
        orderLines: order.orderLines,
        status: .shipped(shippedAt: shipmentDate),
        totalAmount: order.totalAmount,
        createdAt: order.createdAt
    ))
}

func deliverOrder(order: Order, deliveryDate: Date) -> Result<Order, DomainError> {
    guard case .shipped = order.status else {
        return .failure(DomainError.business("発送済みの注文のみ配達完了にできます"))
    }
    
    return .success(Order(
        id: order.id,
        customerId: order.customerId,
        orderLines: order.orderLines,
        status: .delivered(deliveredAt: deliveryDate),
        totalAmount: order.totalAmount,
        createdAt: order.createdAt
    ))
}

func cancelOrder(order: Order, reason: String) -> Result<Order, DomainError> {
    switch order.status {
    case .shipped, .delivered:
        return .failure(DomainError.business("発送済みまたは配達済みの注文はキャンセルできません"))
    default:
        return .success(Order(
            id: order.id,
            customerId: order.customerId,
            orderLines: order.orderLines,
            status: .cancelled(reason: reason),
            totalAmount: order.totalAmount,
            createdAt: order.createdAt
        ))
    }
}
```

### 7.3 ワークフロー実装

```swift
// コマンド（入力）
struct PlaceOrderCommand {
    let customerId: String
    let items: [(productId: String, quantity: Int)]
}

// リポジトリインターフェース
protocol CustomerRepository {
    func findById(id: CustomerId) async -> Result<Customer?, DomainError>
}

protocol ProductRepository {
    func findById(id: ProductId) async -> Result<Product?, DomainError>
}

protocol OrderRepository {
    func save(order: Order) async -> Result<Void, DomainError>
}

// ワークフロー関数
func validateOrder(command: PlaceOrderCommand) -> Result<PlaceOrderCommand, DomainError> {
    guard !command.customerId.isEmpty else {
        return .failure(DomainError.validation("顧客IDは必須です"))
    }
    guard !command.items.isEmpty else {
        return .failure(DomainError.validation("注文項目は1つ以上必要です"))
    }
    guard command.items.allSatisfy({ $0.quantity > 0 }) else {
        return .failure(DomainError.validation("数量は正の値である必要があります"))
    }
    return .success(command)
}

func getCustomer(command: PlaceOrderCommand, repository: CustomerRepository) async -> Result<(PlaceOrderCommand, Customer), DomainError> {
    // 顧客IDを作成
    let customerIdResult = CustomerId.create(command.customerId)
    guard case .success(let customerId) = customerIdResult else {
        return .failure(customerIdResult.failureValue!)
    }
    
    // 顧客を検索
    let customerResult = await repository.findById(id: customerId)
    guard case .success(let maybeCustomer) = customerResult else {
        return .failure(customerResult.failureValue!)
    }
    
    guard let customer = maybeCustomer else {
        return .failure(DomainError.notFound("顧客が見つかりません: \(command.customerId)"))
    }
    
    return .success((command, customer))
}

func getProductDetails(command: PlaceOrderCommand, customer: Customer, repository: ProductRepository) async -> Result<(Customer, [OrderLine]), DomainError> {
    var orderLines: [OrderLine] = []
    
    for item in command.items {
        // 商品IDを作成
        let productIdResult = ProductId.create(item.productId)
        guard case .success(let productId) = productIdResult else {
            return .failure(productIdResult.failureValue!)
        }
        
        // 商品を検索
        let productResult = await repository.findById(id: productId)
        guard case .success(let maybeProduct) = productResult else {
            return .failure(productResult.failureValue!)
        }
        
        guard let product = maybeProduct else {
            return .failure(DomainError.notFound("商品が見つかりません: \(item.productId)"))
        }
        
        // 注文項目を作成
        let orderLine = OrderLine(
            productId: productId,
            quantity: item.quantity,
            unitPrice: product.price
        )
        orderLines.append(orderLine)
    }
    
    return .success((customer, orderLines))
}

func calculateTotalAmount(customer: Customer, orderLines: [OrderLine]) -> Result<(Customer, [OrderLine], Money), DomainError> {
    // 合計金額を計算
    let total = orderLines.reduce(Money.zero) { sum, line in
        sum.add(line.totalPrice)
    }
    
    return .success((customer, orderLines, total))
}

func createOrderEntity(customer: Customer, orderLines: [OrderLine], totalAmount: Money) -> Result<Order, DomainError> {
    // 注文IDを生成
    let orderId = OrderId.generateNew()
    
    // 注文エンティティを作成
    let order = Order(
        id: orderId,
        customerId: customer.id,
        orderLines: orderLines,
        status: .pending,
        totalAmount: totalAmount
    )
    
    return .success(order)
}

// ワークフロー関数
func placeOrderWorkflow(
    command: PlaceOrderCommand,
    customerRepository: CustomerRepository,
    productRepository: ProductRepository,
    orderRepository: OrderRepository
) async -> Result<Order, DomainError> {
    let validationResult = validateOrder(command)
    
    guard case .success(let validCommand) = validationResult else {
        return .failure(validationResult.failureValue!)
    }
    
    let customerResult = await getCustomer(command: validCommand, repository: customerRepository)
    guard case .success(let (_, customer)) = customerResult else {
        return .failure(customerResult.failureValue!)
    }
    
    let productDetailsResult = await getProductDetails(command: validCommand, customer: customer, repository: productRepository)
    guard case .success(let (verifiedCustomer, orderLines)) = productDetailsResult else {
        return .failure(productDetailsResult.failureValue!)
    }
    
    let totalResult = calculateTotalAmount(customer: verifiedCustomer, orderLines: orderLines)
    guard case .success(let (finalCustomer, finalOrderLines, totalAmount)) = totalResult else {
        return .failure(totalResult.failureValue!)
    }
    
    let orderResult = createOrderEntity(customer: finalCustomer, orderLines: finalOrderLines, totalAmount: totalAmount)
    guard case .success(let order) = orderResult else {
        return .failure(orderResult.failureValue!)
    }
    
    // 注文を保存
    let saveResult = await orderRepository.save(order: order)
    guard case .success = saveResult else {
        return .failure(saveResult.failureValue!)
    }
    
    return .success(order)
}

// Result型の拡張（失敗値取得用）
extension Result {
    var failureValue: Failure? {
        switch self {
        case .success: return nil
        case .failure(let error): return error
        }
    }
}
```

### 7.4 アプリケーション層の実装

```swift
// アプリケーションサービス
actor OrderService {
    private let customerRepository: CustomerRepository
    private let productRepository: ProductRepository
    private let orderRepository: OrderRepository
    
    init(customerRepository: CustomerRepository, productRepository: ProductRepository, orderRepository: OrderRepository) {
        self.customerRepository = customerRepository
        self.productRepository = productRepository
        self.orderRepository = orderRepository
    }
    
    func placeOrder(command: PlaceOrderCommand) async -> Result<OrderId, DomainError> {
        let result = await placeOrderWorkflow(
            command: command,
            customerRepository: customerRepository,
            productRepository: productRepository,
            orderRepository: orderRepository
        )
        
        return result.map { $0.id }
    }
    
    func payOrder(orderId: String, paymentDate: Date = Date()) async -> Result<Void, DomainError> {
        // 注文IDを検証
        let orderIdResult = OrderId.create(orderId)
        guard case .success(let id) = orderIdResult else {
            return .failure(orderIdResult.failureValue!)
        }
        
        // 注文を取得
        let orderResult = await getOrder(id: id)
        guard case .success(let order) = orderResult else {
            return .failure(orderResult.failureValue!)
        }
        
        // ステータスを変更
        let paidOrderResult = payOrder(order: order, paymentDate: paymentDate)
        guard case .success(let paidOrder) = paidOrderResult else {
            return .failure(paidOrderResult.failureValue!)
        }
        
        // 保存
        let saveResult = await orderRepository.save(order: paidOrder)
        return saveResult
    }
    
    private func getOrder(id: OrderId) async -> Result<Order, DomainError> {
        // ここでは仮の実装
        // 実際にはOrderRepositoryから注文を取得する
        return .failure(DomainError.notFound("注文が見つかりません"))
    }
}
```

## 8. 参考リソース

1. **書籍**:
   - "Domain Modeling Made Functional" by Scott Wlaschin
   - "Functional and Reactive Domain Modeling" by Debasish Ghosh
   - "Swift Functional Programming" by Fatih Nayebi

2. **オンラインリソース**:
   - [Swift: Value型と参照型の選択](https://docs.swift.org/swift-book/LanguageGuide/ClassesAndStructures.html)
   - [Pointfree.co](https://www.pointfree.co) - Swiftでの関数型プログラミングを扱うWebサイト
   - [Railway Oriented Programming in Swift](https://juejin.cn/post/6867454357421662215)

3. **コミュニティとライブラリ**:
   - [Swift Functional Programming Community](https://github.com/topics/functional-swift)
   - [SwiftRex](https://github.com/SwiftRex/SwiftRex) - Swiftで実装された関数型・リアクティブプログラミングのフレームワーク

4. **記事**:
   - [WWDC 2015 - Protocol-Oriented Programming in Swift](https://developer.apple.com/videos/play/wwdc2015/408/)
   - [関数型ドメインモデリングをSwiftで実装する](https://medium.com/@jkxyz/functional-domain-modeling-in-swift-5784aecb6a9a)
