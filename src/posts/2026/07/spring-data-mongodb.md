---
titulo: "Spring Data MongoDB: persistencia NoSQL con Spring Boot"
seoTitulo: "Spring Data MongoDB en Spring Boot: guía práctica de persistencia NoSQL con documentos"
fecha: "2026-07-22"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a usar Spring Data MongoDB en Spring Boot: modela documentos con @Document, crea repositorios sin boilerplate, escribe queries derivadas y personalizadas con MongoTemplate, y gestiona índices para consultas eficientes."
imagenPortada: "https://i.imgur.com/4XhZeUs.png?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "MongoDB", "Spring Data", "Java", "Backend", "NoSQL"]
categoria: "tech"
keywords: "Spring Data MongoDB, Spring Boot MongoDB, MongoRepository, @Document, MongoTemplate, NoSQL Java, persistencia MongoDB Spring, queries MongoDB, índices MongoDB Spring Boot, aggregation framework"
---

# Spring Data MongoDB: persistencia NoSQL con Spring Boot

Cuando los datos no encajan bien en tablas relacionales —estructuras variables, documentos anidados, arrays de longitud arbitraria o esquemas que evolucionan con frecuencia— MongoDB ofrece una alternativa natural. Spring Data MongoDB lleva la misma filosofía de Spring Data JPA al mundo de los documentos: repositorios sin implementación manual, queries derivadas del nombre del método y acceso de bajo nivel cuando lo necesitas.

Este artículo cubre desde la configuración inicial hasta las consultas avanzadas con `MongoTemplate` y aggregation pipelines.

## Dependencias y configuración

Agrega el starter de MongoDB a tu proyecto Spring Boot:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-mongodb</artifactId>
</dependency>
```

La configuración mínima en `application.yml`:

```yaml
spring:
  data:
    mongodb:
      uri: mongodb://localhost:27017/mydb
```

Si usas autenticación:

```yaml
spring:
  data:
    mongodb:
      uri: mongodb://user:password@localhost:27017/mydb?authSource=admin
```

Para MongoDB Atlas (la nube administrada de MongoDB):

```yaml
spring:
  data:
    mongodb:
      uri: mongodb+srv://user:password@cluster0.example.mongodb.net/mydb
```

Spring Boot autoconfigura `MongoClient` y `MongoTemplate` a partir de esta URI. No necesitas ninguna clase de configuración adicional para empezar.

## Modelado de documentos con @Document

Un documento MongoDB es el equivalente a una fila en SQL. Lo mapeas con `@Document`:

```java
@Document(collection = "products")
@Getter
@Setter
@NoArgsConstructor
public class Product {

    @Id
    private String id;          // MongoDB usa ObjectId como _id; String lo mapea automáticamente

    @Field("name")
    private String name;

    private BigDecimal price;

    private String category;

    @DBRef
    private Supplier supplier;  // referencia a otro documento (similar a FK, pero no JOIN)

    private List<String> tags = new ArrayList<>();

    private Address address;    // documento embebido (sin @Document)

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
```

Y la clase embebida `Address`, que se guarda dentro del mismo documento sin colección propia:

```java
@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class Address {
    private String street;
    private String city;
    private String country;
}
```

Puntos clave del modelo:

- **`@Id`**: mapea el campo al `_id` de MongoDB. Si el tipo es `String`, Spring Data genera un `ObjectId` y lo convierte automáticamente.
- **`@Field`**: personaliza el nombre del campo en el documento. Útil para mantener convenciones de nomenclatura distintas entre Java y MongoDB.
- **`@DBRef`**: almacena una referencia al `_id` del documento referenciado. MongoDB **no** realiza joins; la carga es lazy por defecto y requiere una segunda consulta.
- **Documentos embebidos**: incrustar datos relacionados (como `Address`) dentro del mismo documento es la estrategia preferida en MongoDB. Elimina joins y mejora el rendimiento de lectura.
- **`@CreatedDate` / `@LastModifiedDate`**: requieren activar la auditoría con `@EnableMongoAuditing` en una clase de configuración.

### Activar auditoría

```java
@Configuration
@EnableMongoAuditing
public class MongoConfig {
}
```

## Repositorios

La interfaz mínima para un repositorio de documentos:

```java
public interface ProductRepository extends MongoRepository<Product, String> {
}
```

`MongoRepository<Product, String>` te da las operaciones CRUD estándar: `save`, `findById`, `findAll`, `deleteById`, `count`, `existsById`, entre otras.

### Query methods (queries derivadas)

Spring Data MongoDB infiere el query a partir del nombre del método, igual que con JPA:

```java
public interface ProductRepository extends MongoRepository<Product, String> {

    // db.products.find({ name: "..." })
    List<Product> findByName(String name);

    // db.products.find({ price: { $lt: maxPrice } })
    List<Product> findByPriceLessThan(BigDecimal maxPrice);

    // db.products.find({ category: "...", price: { $lte: maxPrice } })
    List<Product> findByCategoryAndPriceLessThanEqual(String category, BigDecimal maxPrice);

    // db.products.find({ tags: "electronics" })
    List<Product> findByTagsContaining(String tag);

    // db.products.find({ "address.city": "..." })
    List<Product> findByAddressCity(String city);

    // db.products.find({ name: /keyword/i })
    List<Product> findByNameContainingIgnoreCase(String keyword);

    boolean existsByName(String name);

    long countByCategory(String category);
}
```

La notación de punto en los nombres de método (`AddressCity`) navega los campos de documentos embebidos. MongoDB traduce esto al path `address.city` en el filtro.

## Queries personalizadas con @Query

Para queries más complejas, usa la anotación `@Query` con la sintaxis JSON de MongoDB:

```java
public interface ProductRepository extends MongoRepository<Product, String> {

    // Búsqueda de texto con regex (insensible a mayúsculas)
    @Query("{ 'name': { $regex: ?0, $options: 'i' } }")
    List<Product> searchByName(String pattern);

    // Filtro por rango de precio y categoría
    @Query("{ 'price': { $gte: ?0, $lte: ?1 }, 'category': ?2 }")
    List<Product> findByPriceRangeAndCategory(BigDecimal min, BigDecimal max, String category);

    // Proyección: devuelve solo name y price (sin el resto de campos)
    @Query(value = "{ 'category': ?0 }", fields = "{ 'name': 1, 'price': 1 }")
    List<Product> findNameAndPriceByCategory(String category);

    // Operador $in: busca documentos cuya categoría esté en la lista
    @Query("{ 'category': { $in: ?0 } }")
    List<Product> findByCategoryIn(List<String> categories);

    // Documentos con el array 'tags' no vacío
    @Query("{ 'tags': { $exists: true, $not: { $size: 0 } } }")
    List<Product> findWithTags();
}
```

En `@Query`, `?0`, `?1`, `?2` son parámetros posicionales. El valor de `fields` es la proyección de MongoDB: `1` incluye el campo, `0` lo excluye.

## MongoTemplate: control de bajo nivel

`MongoTemplate` es el punto de acceso de bajo nivel, equivalente a `JdbcTemplate` en el mundo relacional. Úsalo cuando las queries derivadas y `@Query` no son suficientes.

```java
@Service
@RequiredArgsConstructor
public class ProductService {

    private final MongoTemplate mongoTemplate;

    public List<Product> findExpensiveInCategory(String category, BigDecimal minPrice) {
        Query query = new Query(
            Criteria.where("category").is(category)
                    .and("price").gte(minPrice)
        ).with(Sort.by(Sort.Direction.DESC, "price"))
         .limit(10);

        return mongoTemplate.find(query, Product.class);
    }

    public long countByTag(String tag) {
        Query query = new Query(Criteria.where("tags").in(tag));
        return mongoTemplate.count(query, Product.class);
    }

    public UpdateResult updatePrice(String id, BigDecimal newPrice) {
        Query query = new Query(Criteria.where("id").is(id));
        Update update = new Update().set("price", newPrice);
        return mongoTemplate.updateFirst(query, update, Product.class);
    }

    public void addTagToAllInCategory(String category, String tag) {
        Query query = new Query(Criteria.where("category").is(category));
        Update update = new Update().addToSet("tags", tag); // $addToSet evita duplicados
        mongoTemplate.updateMulti(query, update, Product.class);
    }
}
```

La clase `Criteria` construye los filtros de forma fluida. `Update` construye las operaciones de modificación usando los operadores de MongoDB (`$set`, `$unset`, `$inc`, `$addToSet`, `$push`, `$pull`, etc.).

## Paginación

La paginación funciona igual que en Spring Data JPA:

```java
public interface ProductRepository extends MongoRepository<Product, String> {

    Page<Product> findByCategory(String category, Pageable pageable);

    @Query("{ 'name': { $regex: ?0, $options: 'i' } }")
    Page<Product> search(String keyword, Pageable pageable);
}
```

Desde el servicio:

```java
public Page<Product> searchProducts(String keyword, int page, int size) {
    Pageable pageable = PageRequest.of(page, size, Sort.by("price").ascending());
    return productRepository.search(keyword, pageable);
}
```

## Índices

MongoDB realiza las consultas en un full collection scan si no existen índices. Para colecciones grandes, los índices son imprescindibles.

### Índices con anotaciones

```java
@Document(collection = "products")
public class Product {

    @Id
    private String id;

    @Indexed(unique = true)
    private String sku;                   // índice único

    @Indexed
    private String category;              // índice simple

    @TextIndexed
    private String description;           // índice de texto completo

    private BigDecimal price;
}
```

Activa la creación automática de índices en `application.yml`:

```yaml
spring:
  data:
    mongodb:
      auto-index-creation: true
```

### Índices compuestos con @CompoundIndex

```java
@Document(collection = "products")
@CompoundIndex(name = "category_price_idx", def = "{ 'category': 1, 'price': -1 }")
public class Product {
    // ...
}
```

El número `1` indica orden ascendente y `-1` descendente. Los índices compuestos aceleran consultas que filtran por ambos campos a la vez.

### Crear índices programáticamente

En producción es preferible crear índices de forma explícita para tener control total sobre el proceso:

```java
@Component
@RequiredArgsConstructor
public class MongoIndexInitializer implements ApplicationRunner {

    private final MongoTemplate mongoTemplate;

    @Override
    public void run(ApplicationArguments args) {
        IndexOperations indexOps = mongoTemplate.indexOps(Product.class);

        // Índice compuesto
        indexOps.ensureIndex(new Index()
            .on("category", Sort.Direction.ASC)
            .on("price", Sort.Direction.DESC)
            .named("category_price_idx"));

        // Índice único
        indexOps.ensureIndex(new Index()
            .on("sku", Sort.Direction.ASC)
            .unique()
            .named("sku_unique_idx"));

        // Índice TTL: elimina documentos automáticamente después de 30 días
        indexOps.ensureIndex(new Index()
            .on("createdAt", Sort.Direction.ASC)
            .expire(30, TimeUnit.DAYS)
            .named("ttl_30days_idx"));
    }
}
```

Los **índices TTL** son una característica de MongoDB que expira y elimina documentos automáticamente. Son útiles para logs, sesiones, tokens temporales o cualquier dato con vida útil acotada.

## Aggregation Framework

El aggregation pipeline de MongoDB permite transformar y agrupar documentos en varias etapas. `MongoTemplate` lo expone con una API fluida:

```java
@Service
@RequiredArgsConstructor
public class ProductStatsService {

    private final MongoTemplate mongoTemplate;

    // Precio promedio por categoría
    public List<CategoryStats> getAveragepriceByCategory() {
        Aggregation aggregation = Aggregation.newAggregation(
            Aggregation.group("category")
                .avg("price").as("averagePrice")
                .count().as("totalProducts"),
            Aggregation.sort(Sort.Direction.DESC, "averagePrice"),
            Aggregation.project("averagePrice", "totalProducts")
                .and("_id").as("category")
        );

        return mongoTemplate.aggregate(
            aggregation, "products", CategoryStats.class
        ).getMappedResults();
    }

    // Productos más caros por categoría (top 1 por grupo)
    public List<Product> getMostExpensivePerCategory() {
        Aggregation aggregation = Aggregation.newAggregation(
            Aggregation.sort(Sort.Direction.DESC, "price"),
            Aggregation.group("category")
                .first("$$ROOT").as("product"),
            Aggregation.replaceRoot("product")
        );

        return mongoTemplate.aggregate(
            aggregation, "products", Product.class
        ).getMappedResults();
    }
}

public record CategoryStats(String category, Double averagePrice, Long totalProducts) {}
```

Las etapas más usadas del pipeline son:

- **`$match`**: filtra documentos (equivalente a `WHERE` en SQL).
- **`$group`**: agrupa y calcula acumuladores (`$avg`, `$sum`, `$min`, `$max`, `$count`).
- **`$sort`**: ordena los documentos.
- **`$project`**: selecciona o transforma campos (equivalente a `SELECT`).
- **`$limit` / `$skip`**: paginación.
- **`$lookup`**: join entre colecciones (usar con moderación).
- **`$unwind`**: descompone arrays en documentos individuales.

## Buenas prácticas

**Diseña el esquema orientado a las queries.** En MongoDB el esquema se diseña pensando en cómo se consultan los datos, no en la normalización. Si siempre lees un producto con su categoría, incrustar la categoría en el documento de producto es más eficiente que usar `@DBRef`.

**Evita `@DBRef` cuando puedas.** Las referencias `@DBRef` requieren una segunda consulta para cargar el documento referenciado. En muchos casos, incrustar los datos relevantes o guardar solo el ID y resolver la referencia en la capa de servicio es más eficiente.

**No abuses de `auto-index-creation`** en producción. La creación automática de índices al arrancar puede causar problemas si las colecciones son grandes. Gestiona los índices como parte del proceso de despliegue.

**Limita el tamaño de los arrays embebidos.** MongoDB tiene un límite de 16 MB por documento. Arrays que crecen indefinidamente son un antipatrón; considera moverlos a una colección separada si pueden superar cientos de elementos.

**Usa `MongoRepository` para CRUD simple y `MongoTemplate` para queries complejas.** La combinación de ambos cubre la mayoría de los casos sin sacrificar legibilidad ni flexibilidad.

**Activa el profiler de MongoDB en desarrollo** para detectar queries lentas y consultas sin índice:

```javascript
// En la consola de MongoDB
db.setProfilingLevel(1, { slowms: 100 })  // loguea queries > 100ms
db.system.profile.find().sort({ ts: -1 }).limit(10)
```

## Resumen

Spring Data MongoDB sigue la misma filosofía de Spring Data JPA: un repositorio declarativo te ahorra el código repetitivo y `MongoTemplate` cubre los casos que la abstracción no alcanza. Los conceptos centrales son:

- **`@Document`**: mapea una clase Java a una colección MongoDB. Los documentos embebidos son la estrategia preferida para relacionar datos.
- **`MongoRepository`**: repositorio con CRUD y queries derivadas sin implementación manual.
- **`@Query`**: queries personalizadas con la sintaxis JSON de MongoDB.
- **`MongoTemplate`**: acceso de bajo nivel con `Criteria`, `Query` y `Update` para escenarios complejos.
- **Índices**: imprescindibles para consultas eficientes. Los índices TTL añaden expiración automática de documentos.
- **Aggregation pipeline**: transforma y agrupa documentos en múltiples etapas para reportes y análisis.

La elección entre JPA/SQL y MongoDB no es ideológica. Si tus datos son naturalmente documentales, con esquemas variables o estructuras jerárquicas profundas, MongoDB simplifica el modelo. Si tus datos son relacionales y la integridad referencial es crítica, una base de datos SQL sigue siendo la opción más robusta.
