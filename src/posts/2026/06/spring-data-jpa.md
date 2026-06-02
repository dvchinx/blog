---
titulo: "Spring Data JPA: persistencia sin boilerplate"
seoTitulo: "Spring Data JPA: guía práctica para persistencia en Spring Boot"
fecha: "2026-06-03"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a usar Spring Data JPA para gestionar la capa de persistencia en Spring Boot: repositorios, queries derivadas, JPQL personalizado y paginación."
imagenPortada: "https://images.unsplash.com/photo-1542744173-05336fcc7ad4?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Spring Data JPA", "JPA", "Java", "Backend", "Hibernate"]
categoria: "tech"
keywords: "Spring Data JPA, Spring Boot JPA, repositorios JPA, JPQL, Hibernate Spring Boot, paginación Spring, entidades JPA, query methods"
---

# Spring Data JPA: persistencia sin boilerplate

Toda aplicación backend eventualmente necesita leer y escribir datos. Spring Data JPA elimina la mayor parte del código repetitivo que eso implica: no más DAOs manuales, no más SQL para operaciones CRUD básicas, y queries complejas expresadas directamente en el nombre del método.

Este artículo cubre las piezas esenciales: entidades, repositorios, queries derivadas, JPQL personalizado y paginación.

## Dependencias

En un proyecto Spring Boot, basta con agregar el starter de JPA junto con el driver de la base de datos:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <scope>runtime</scope>
</dependency>
```

La configuración mínima en `application.yml`:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/mydb
    username: postgres
    password: secret
  jpa:
    hibernate:
      ddl-auto: update
    show-sql: true
    properties:
      hibernate:
        format_sql: true
```

`ddl-auto: update` hace que Hibernate sincronice el esquema con las entidades al arrancar. En producción es preferible usar `validate` y gestionar migraciones con Flyway o Liquibase.

## Entidades

Una entidad es una clase Java mapeada a una tabla de base de datos:

```java
@Entity
@Table(name = "products")
@Getter
@Setter
@NoArgsConstructor
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal price;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}
```

Algunos puntos relevantes:

- `@GeneratedValue(strategy = GenerationType.IDENTITY)` delega la generación del ID a la base de datos (autoincrement).
- `FetchType.LAZY` en la relación `@ManyToOne` evita cargar la categoría hasta que se acceda explícitamente, lo que reduce consultas innecesarias.
- `@CreationTimestamp` y `@UpdateTimestamp` son anotaciones de Hibernate que rellenan los campos automáticamente.

La entidad `Category` quedaría así:

```java
@Entity
@Table(name = "categories")
@Getter
@Setter
@NoArgsConstructor
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 60)
    private String name;

    @OneToMany(mappedBy = "category", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<Product> products = new ArrayList<>();
}
```

## Repositorios

Spring Data JPA genera la implementación en tiempo de ejecución. Solo necesitas una interfaz:

```java
public interface ProductRepository extends JpaRepository<Product, Long> {
}
```

`JpaRepository<Product, Long>` te da sin escribir una sola línea:

- `save(entity)` – inserta o actualiza.
- `findById(id)` – devuelve `Optional<Product>`.
- `findAll()` – lista todos los registros.
- `deleteById(id)` – elimina por ID.
- `count()` – cuenta registros.
- `existsById(id)` – verifica existencia.

## Query methods (queries derivadas)

Spring Data JPA puede inferir queries SQL a partir del nombre del método. La convención es `findBy` + nombre del campo + condición:

```java
public interface ProductRepository extends JpaRepository<Product, Long> {

    // SELECT * FROM products WHERE name = ?
    List<Product> findByName(String name);

    // SELECT * FROM products WHERE price < ?
    List<Product> findByPriceLessThan(BigDecimal maxPrice);

    // SELECT * FROM products WHERE name LIKE %?% AND price <= ?
    List<Product> findByNameContainingIgnoreCaseAndPriceLessThanEqual(
            String keyword, BigDecimal maxPrice);

    // SELECT * FROM products WHERE category_id = ?
    List<Product> findByCategoryId(Long categoryId);

    // EXISTS query
    boolean existsByName(String name);

    // COUNT query
    long countByCategoryId(Long categoryId);
}
```

El motor parsea el nombre del método y genera el SQL correspondiente. Los keywords más usados son `And`, `Or`, `Like`, `Containing`, `StartingWith`, `EndingWith`, `IgnoreCase`, `LessThan`, `GreaterThan`, `Between`, `IsNull`, `IsNotNull`.

## JPQL personalizado con @Query

Para queries más complejas, usa la anotación `@Query` con JPQL (Java Persistence Query Language), que trabaja con nombres de entidades y campos Java, no con nombres de tablas SQL:

```java
public interface ProductRepository extends JpaRepository<Product, Long> {

    @Query("SELECT p FROM Product p WHERE p.category.name = :categoryName ORDER BY p.price ASC")
    List<Product> findByCategoryNameOrderByPrice(@Param("categoryName") String categoryName);

    @Query("SELECT p FROM Product p WHERE p.price BETWEEN :min AND :max")
    List<Product> findByPriceRange(
            @Param("min") BigDecimal min,
            @Param("max") BigDecimal max);

    @Query("SELECT p FROM Product p JOIN FETCH p.category WHERE p.id = :id")
    Optional<Product> findByIdWithCategory(@Param("id") Long id);
}
```

`JOIN FETCH` en el último ejemplo fuerza la carga de la categoría en la misma consulta, resolviendo el problema N+1 cuando sabes que necesitarás esa relación.

Para operaciones de modificación, añade `@Modifying` y `@Transactional`:

```java
@Modifying
@Transactional
@Query("UPDATE Product p SET p.price = p.price * :factor WHERE p.category.id = :categoryId")
int updatePriceByCategory(@Param("factor") BigDecimal factor, @Param("categoryId") Long categoryId);
```

## SQL nativo

Cuando necesites features específicos de la base de datos que JPQL no soporta, puedes usar SQL nativo con `nativeQuery = true`:

```java
@Query(value = "SELECT * FROM products WHERE EXTRACT(MONTH FROM created_at) = :month",
       nativeQuery = true)
List<Product> findByCreationMonth(@Param("month") int month);
```

Úsalo con moderación: las queries nativas acoplan tu código al dialecto SQL de la base de datos.

## Paginación y ordenamiento

Para resultados paginados, el repositorio recibe un `Pageable` y devuelve un `Page`:

```java
public interface ProductRepository extends JpaRepository<Product, Long> {

    Page<Product> findByPriceLessThan(BigDecimal maxPrice, Pageable pageable);

    @Query("SELECT p FROM Product p WHERE p.name LIKE %:keyword%")
    Page<Product> search(@Param("keyword") String keyword, Pageable pageable);
}
```

Desde el servicio o controlador:

```java
@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;

    public Page<Product> searchProducts(String keyword, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("price").ascending());
        return productRepository.search(keyword, pageable);
    }
}
```

`Page<Product>` contiene el contenido de la página, el total de registros, el total de páginas y los metadatos de paginación, útiles para construir respuestas de API con información de navegación.

## Proyecciones

A veces no necesitas cargar toda la entidad. Las proyecciones te permiten seleccionar solo los campos que necesitas:

```java
public interface ProductSummary {
    Long getId();
    String getName();
    BigDecimal getPrice();
}

public interface ProductRepository extends JpaRepository<Product, Long> {
    List<ProductSummary> findByCategoryId(Long categoryId);
}
```

Spring Data JPA mapea automáticamente el resultado al tipo de la proyección. También puedes usar records de Java como proyecciones con `@Query`:

```java
public record ProductDto(Long id, String name, BigDecimal price) {}

@Query("SELECT new com.example.dto.ProductDto(p.id, p.name, p.price) FROM Product p WHERE p.category.id = :id")
List<ProductDto> findSummaryByCategoryId(@Param("id") Long id);
```

## Ciclo de vida de las entidades

JPA define callbacks que permiten ejecutar lógica en distintos momentos del ciclo de vida de la entidad:

```java
@Entity
public class Product {

    // ... campos

    @PrePersist
    protected void onCreate() {
        // Se ejecuta antes del INSERT
    }

    @PreUpdate
    protected void onUpdate() {
        // Se ejecuta antes del UPDATE
    }

    @PostLoad
    protected void onLoad() {
        // Se ejecuta después de cargar la entidad desde la BD
    }
}
```

Para lógica compartida entre entidades, es preferible usar una clase base con `@MappedSuperclass`:

```java
@MappedSuperclass
@Getter
@Setter
public abstract class Auditable {

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;
}

@Entity
public class Product extends Auditable {
    // Solo los campos propios del producto
}
```

## Problema N+1 y cómo evitarlo

El problema N+1 ocurre cuando cargas una lista de entidades y luego accedes a una relación lazy en cada una, disparando una query adicional por elemento:

```java
// Esto genera 1 query para los productos + N queries para las categorías
List<Product> products = productRepository.findAll();
products.forEach(p -> System.out.println(p.getCategory().getName())); // N+1!
```

Soluciones:

**1. JOIN FETCH en la query:**

```java
@Query("SELECT p FROM Product p JOIN FETCH p.category")
List<Product> findAllWithCategory();
```

**2. `@EntityGraph`:**

```java
@EntityGraph(attributePaths = {"category"})
List<Product> findAll();
```

**3. Proyecciones** que solo incluyan los campos que necesitas, sin navegar la relación.

Habilita `show-sql: true` en desarrollo para detectar estos patrones a tiempo.

## Buenas prácticas

1. **Usa `FetchType.LAZY` por defecto** en todas las relaciones. Carga eager solo cuando realmente lo necesites.
2. **Evita `ddl-auto: update` en producción**. Usa Flyway o Liquibase para migraciones controladas.
3. **Mantén las transacciones en la capa de servicio**, no en los repositorios ni en los controladores.
4. **Usa proyecciones y DTOs** para queries de lectura: reduces el payload y evitas exponer entidades de dominio directamente en la API.
5. **No expongas entidades JPA en los endpoints** directamente. El ciclo de vida de Hibernate puede causar serialización inesperada o excepciones `LazyInitializationException`.
6. **Activa el log de SQL solo en desarrollo** (`show-sql: true`). En producción introduce ruido innecesario en los logs.

## Conclusión

Spring Data JPA reduce drásticamente el código necesario para la capa de persistencia. Los repositorios con query methods cubren la mayoría de los casos cotidianos; `@Query` con JPQL o SQL nativo resuelve los escenarios más complejos; y las proyecciones permiten queries eficientes sin cargar entidades completas.

El mayor riesgo al trabajar con JPA es no entender cuándo y cuántas queries se ejecutan. Revisar los logs SQL en desarrollo y conocer el comportamiento de fetch son hábitos que evitan problemas de rendimiento en producción.
