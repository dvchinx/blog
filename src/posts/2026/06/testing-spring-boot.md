---
titulo: "Testing en Spring Boot: JUnit 5 y Mockito"
seoTitulo: "Testing en Spring Boot: guía práctica con JUnit 5, Mockito y MockMvc"
fecha: "2026-06-05"
nombreAutor: "Jesús Flórez"
fotoAutor: "/authors/jesus-florez.jpeg"
descripcion: "Aprende a escribir pruebas unitarias e de integración en Spring Boot usando JUnit 5, Mockito para mocking y MockMvc para la capa web. Cubre @WebMvcTest, @DataJpaTest y @SpringBootTest."
imagenPortada: "https://images.unsplash.com/photo-1516116216624-53e697fedbea?w=800&h=500&fit=crop"
etiquetas: ["Spring Boot", "Testing", "JUnit 5", "Mockito", "MockMvc", "Java", "Backend"]
categoria: "tech"
keywords: "Spring Boot testing, JUnit 5 Spring Boot, Mockito Spring, MockMvc tutorial, @WebMvcTest, @DataJpaTest, @SpringBootTest, pruebas unitarias Java, pruebas de integración Spring"
---

# Testing en Spring Boot: JUnit 5, Mockito y MockMvc

Escribir código que funciona es el mínimo. Escribir código que puedes verificar que sigue funcionando después de cada cambio es lo que separa un proyecto mantenible de uno frágil.

Spring Boot tiene soporte de primera clase para testing: viene con JUnit 5, Mockito y una serie de anotaciones que permiten levantar solo las capas necesarias para cada tipo de prueba. Esto hace que los tests sean rápidos, aislados y fáciles de razonar.

Este artículo cubre las tres capas más comunes: tests unitarios del servicio con Mockito, tests del controlador con MockMvc y tests del repositorio con `@DataJpaTest`.

## Dependencias

El starter `spring-boot-starter-test` incluye todo lo necesario y se agrega automáticamente en los proyectos generados con Spring Initializr:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-test</artifactId>
    <scope>test</scope>
</dependency>
```

Bajo el capó incluye JUnit 5 (Jupiter), Mockito, AssertJ, Hamcrest y las clases de soporte de Spring Test. No necesitas agregar estas librerías por separado.

## Pruebas unitarias con Mockito

Las pruebas unitarias verifican una clase en aislamiento, sin levantar el contexto de Spring. Mockito se usa para simular las dependencias.

Tomemos como ejemplo un servicio que gestiona productos:

```java
@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;

    public Product getById(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> new ProductNotFoundException("Producto no encontrado: " + id));
    }

    public Product create(ProductRequest request) {
        if (productRepository.existsByName(request.name())) {
            throw new DuplicateProductException("Ya existe un producto con ese nombre");
        }
        Product product = new Product(request.name(), request.price());
        return productRepository.save(product);
    }
}
```

El test unitario correspondiente:

```java
@ExtendWith(MockitoExtension.class)
class ProductServiceTest {

    @Mock
    private ProductRepository productRepository;

    @InjectMocks
    private ProductService productService;

    @Test
    void getById_returnsProduct_whenExists() {
        Product product = new Product(1L, "Laptop", new BigDecimal("999.99"));
        when(productRepository.findById(1L)).thenReturn(Optional.of(product));

        Product result = productService.getById(1L);

        assertThat(result.getName()).isEqualTo("Laptop");
        verify(productRepository).findById(1L);
    }

    @Test
    void getById_throwsException_whenNotFound() {
        when(productRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> productService.getById(99L))
                .isInstanceOf(ProductNotFoundException.class)
                .hasMessageContaining("99");
    }

    @Test
    void create_savesProduct_whenNameIsUnique() {
        ProductRequest request = new ProductRequest("Teclado", new BigDecimal("79.99"));
        Product saved = new Product(1L, "Teclado", new BigDecimal("79.99"));

        when(productRepository.existsByName("Teclado")).thenReturn(false);
        when(productRepository.save(any(Product.class))).thenReturn(saved);

        Product result = productService.create(request);

        assertThat(result.getId()).isEqualTo(1L);
        verify(productRepository).save(any(Product.class));
    }

    @Test
    void create_throwsException_whenNameAlreadyExists() {
        ProductRequest request = new ProductRequest("Laptop", new BigDecimal("999.99"));
        when(productRepository.existsByName("Laptop")).thenReturn(true);

        assertThatThrownBy(() -> productService.create(request))
                .isInstanceOf(DuplicateProductException.class);

        verify(productRepository, never()).save(any());
    }
}
```

Puntos clave:

- `@ExtendWith(MockitoExtension.class)` activa Mockito sin levantar Spring.
- `@Mock` crea un doble del repositorio; `@InjectMocks` inyecta ese doble en el servicio.
- `when(...).thenReturn(...)` define el comportamiento del mock para cada escenario.
- `verify(...)` comprueba que se llamaron los métodos esperados.
- `assertThatThrownBy(...)` es la forma idiomática de AssertJ para verificar excepciones.

## Pruebas del controlador con @WebMvcTest

`@WebMvcTest` levanta solo la capa web: controllers, filtros y configuración de seguridad básica, sin los servicios ni los repositorios. Es más rápido que `@SpringBootTest` y está enfocado en verificar que las rutas, la serialización y las respuestas HTTP son correctas.

```java
@WebMvcTest(ProductController.class)
class ProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ProductService productService;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void getById_returns200_withProduct() throws Exception {
        Product product = new Product(1L, "Laptop", new BigDecimal("999.99"));
        when(productService.getById(1L)).thenReturn(product);

        mockMvc.perform(get("/api/products/1")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.name").value("Laptop"))
                .andExpect(jsonPath("$.price").value(999.99));
    }

    @Test
    void getById_returns404_whenNotFound() throws Exception {
        when(productService.getById(99L))
                .thenThrow(new ProductNotFoundException("Producto no encontrado: 99"));

        mockMvc.perform(get("/api/products/99"))
                .andExpect(status().isNotFound());
    }

    @Test
    void create_returns201_withValidRequest() throws Exception {
        ProductRequest request = new ProductRequest("Teclado", new BigDecimal("79.99"));
        Product saved = new Product(1L, "Teclado", new BigDecimal("79.99"));
        when(productService.create(any(ProductRequest.class))).thenReturn(saved);

        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    void create_returns400_withInvalidRequest() throws Exception {
        // nombre vacío y precio negativo deben fallar la validación
        String invalidJson = """
                {"name": "", "price": -10}
                """;

        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidJson))
                .andExpect(status().isBadRequest());
    }
}
```

`@MockBean` registra el servicio como un bean mock en el contexto de Spring. Es distinto de `@Mock` de Mockito: este reemplaza el bean real en el contexto de Spring para que el controlador lo reciba por inyección.

`MockMvc` simula peticiones HTTP sin levantar un servidor real. Los métodos `andExpect(...)` verifican el código de respuesta, los headers y el cuerpo JSON.

## Pruebas del repositorio con @DataJpaTest

`@DataJpaTest` levanta solo la capa de persistencia: configura una base de datos en memoria (H2 por defecto), escanea entidades y repositorios, y envuelve cada test en una transacción que se revierte al terminar.

```java
@DataJpaTest
class ProductRepositoryTest {

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void findByName_returnsProduct_whenExists() {
        entityManager.persist(new Product("Monitor", new BigDecimal("350.00")));
        entityManager.flush();

        List<Product> result = productRepository.findByName("Monitor");

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getName()).isEqualTo("Monitor");
    }

    @Test
    void existsByName_returnsTrue_whenProductExists() {
        entityManager.persist(new Product("Ratón", new BigDecimal("25.00")));
        entityManager.flush();

        boolean exists = productRepository.existsByName("Ratón");

        assertThat(exists).isTrue();
    }

    @Test
    void existsByName_returnsFalse_whenProductDoesNotExist() {
        boolean exists = productRepository.existsByName("NoExiste");

        assertThat(exists).isFalse();
    }

    @Test
    void findByPriceLessThan_returnsFilteredProducts() {
        entityManager.persist(new Product("Teclado", new BigDecimal("50.00")));
        entityManager.persist(new Product("Monitor", new BigDecimal("350.00")));
        entityManager.persist(new Product("Laptop", new BigDecimal("1000.00")));
        entityManager.flush();

        List<Product> result = productRepository.findByPriceLessThan(new BigDecimal("200.00"));

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getName()).isEqualTo("Teclado");
    }
}
```

`TestEntityManager` es una envoltura de `EntityManager` diseñada para tests. Permite insertar datos sin pasar por el repositorio bajo prueba, lo que hace los tests más directos.

Si necesitas trabajar con la base de datos real en lugar de H2, puedes reemplazar el datasource con `@AutoConfigureTestDatabase(replace = Replace.NONE)`:

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class ProductRepositoryTest {
    // usa la base de datos configurada en application-test.yml
}
```

## Pruebas de integración con @SpringBootTest

`@SpringBootTest` levanta el contexto de Spring completo. Úsalo cuando necesitas verificar que todas las capas funcionan juntas: desde la petición HTTP hasta la base de datos.

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@Transactional
class ProductIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void createAndRetrieveProduct_endToEnd() throws Exception {
        ProductRequest request = new ProductRequest("SSD", new BigDecimal("120.00"));

        // Crea el producto
        String responseBody = mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andReturn()
                .getResponse()
                .getContentAsString();

        Long id = objectMapper.readTree(responseBody).get("id").asLong();

        // Verifica que se puede recuperar
        mockMvc.perform(get("/api/products/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("SSD"))
                .andExpect(jsonPath("$.price").value(120.00));

        // Verifica directamente en la base de datos
        assertThat(productRepository.findById(id)).isPresent();
    }
}
```

`@Transactional` en la clase de test hace que cada método se ejecute en una transacción que se revierte al terminar, manteniendo la base de datos limpia entre tests.

`WebEnvironment.RANDOM_PORT` levanta el servidor en un puerto aleatorio, lo que evita conflictos si varios tests corren en paralelo.

## Estructura recomendada de tests

Una buena práctica es seguir la pirámide de tests:

- **Unitarios** (más): rápidos, aislados, verifican la lógica de negocio. Usa `@ExtendWith(MockitoExtension.class)`.
- **De capa** (medios): `@WebMvcTest` para controladores, `@DataJpaTest` para repositorios. Moderadamente rápidos.
- **De integración** (menos): `@SpringBootTest` para flujos completos. Más lentos, úsalos para los caminos críticos.

La convención de nombres más común es `ClaseTest` para unitarios y `ClaseIT` o `ClaseIntegrationTest` para integración, lo que permite separarlos en el build con perfiles de Maven o Gradle.

## Buenas prácticas

1. **Un assert por concepto, no por línea**: un test puede tener varios `assertThat`, siempre que todos verifiquen el mismo comportamiento. No dividas un test coherente en varios métodos artificiales.
2. **Nombres descriptivos**: `metodoBajoTest_resultadoEsperado_condicion` (estilo `given_when_then` o `should_when`) hace que los fallos sean autoexplicativos.
3. **Evita lógica en los tests**: condicionales y bucles en tests son una señal de que el test está haciendo demasiado. Prefiere múltiples tests simples.
4. **No mockees lo que no controlas**: no hagas mocks de clases de terceros directamente; envuélvelas en tu propio adaptador y mockea ese.
5. **Usa `@TestPropertySource` o perfiles** para separar la configuración de test de la de producción.
6. **Revisa la cobertura como guía, no como meta**: el 100% de cobertura no garantiza tests útiles. Cubre los caminos de negocio críticos, los casos límite y los errores esperados.

## Conclusión

Spring Boot ofrece un ecosistema de testing bien pensado: `@WebMvcTest` para la capa web, `@DataJpaTest` para la persistencia y `@SpringBootTest` para la integración completa. Cada anotación levanta solo lo necesario, manteniendo los tests rápidos y enfocados.

La clave es usar el nivel correcto para cada caso: los tests unitarios con Mockito son tu primera línea para verificar la lógica de negocio; MockMvc confirma que tus endpoints responden bien; `@DataJpaTest` protege las queries complejas; y los tests de integración dan confianza en los flujos end-to-end. Bien distribuidos, hacen que cada cambio sea seguro de desplegar.
