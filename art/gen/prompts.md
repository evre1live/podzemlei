# «Под Землёй» — промты для картинок игры

## Задание для ChatGPT

Ты рисуешь графику для браузерной карточной игры «Под Землёй» в стиле тёмного фэнтези: подземелья, таверны, кузни гномов, свечи и золото. Ниже 56 картинок в пяти разделах. Сначала прочитай общие правила, потом рисуй картинки **строго по одной, по порядку**: одно сообщение — одна картинка. Под картинкой напиши её имя файла (например, `mat-default.png`) и жди моего слова «дальше». Если я напишу «переделай», сделай эту же картинку заново, учитывая моё замечание.

Сами промты написаны по-английски. Используй каждый целиком и ничего не добавляй от себя: ни людей, ни надписей, ни лишних предметов.

## Общие правила (для всех картинок)

- Фотореалистичные материалы с чёткой мелкой фактурой: дерево, металл, камень, кожа, ткань. Стиль — тёмное фэнтези, атмосфера настольной игры при свечах.
- **Никакого текста**: ни букв, ни цифр, ни подписей, ни логотипов, ни водяных знаков. Руны — только абстрактные угловатые знаки, не похожие на настоящие буквы.
- Никаких людей, рук и персонажей.
- Свет — тёплый, мягкий, как от свечей, сверху слева.
- Где сказано «transparent background», фон должен быть **прозрачным** (PNG с альфа-каналом), без тени и без поверхности под предметом. Если прозрачный фон не получается, сделай фон однотонным ярко-пурпурным `#FF00FF` — я вырежу его сам.
- Размеры: 1536×1024 (горизонтальная), 1024×1024 (квадрат). У каждой картинки размер указан.

---

## A. Поля игрового стола (14 картинок) — самое важное

Это поверхность, на которой лежат карты во время партии; у каждой локации своё поле. Сверху лягут **белый текст и карты**, поэтому поле должно быть средне-тёмным, без больших светлых пятен. На телефоне поле обрезается по бокам, на широком экране — сверху и снизу. Поэтому узор в центре должен помещаться в **центральные 45 % ширины и 60 % высоты**, а края — быть спокойным сплошным материалом.

Хвост, который входит в каждый промт этого раздела (уже вписан ниже):
*Strict top-down orthographic view, the surface fills the whole image edge to edge, no table edge, no frame, no border, no objects on it. No text, no letters, no numbers, no logos, no watermark. Soft even warm candlelight from the upper left, no strong vignette, no glare hotspots. Overall mid-dark tone, no large bright areas. Any central emblem stays inside the central 45% of the width and 60% of the height; the edges are plain continuous material. Photorealistic material texture, sharp fine detail, dark fantasy board-game style. Landscape 1536×1024.*

### A0. `mat-default.png` — Подземелье (поле по умолчанию)
> A worn dark-brown leather play mat with fine pebbled leather grain and subtle scuffs where cards slide, with a large blind-embossed compass rose in the center (a circle with eight points and fine tick marks) pressed into the leather, not painted, same color as the leather. Strict top-down orthographic view, the surface fills the whole image edge to edge, no table edge, no frame, no border, no objects on it. No text, no letters, no numbers, no logos, no watermark. Soft even warm candlelight from the upper left, no strong vignette, no glare hotspots. Overall mid-dark tone, no large bright areas. Any central emblem stays inside the central 45% of the width and 60% of the height; the edges are plain continuous material. Photorealistic material texture, sharp fine detail, dark fantasy board-game style. Landscape 1536×1024.

### A1. `mat-tavern.png` — Таверна «Хмельной кабан»
> An old tavern tabletop made of six wide oak planks running horizontally, warm honey-brown wood with clearly visible natural grain, dark narrow seams between the planks, a few faint wet rings left by beer mugs, light knife scratches and a couple of old wax drips. Strict top-down orthographic view, the surface fills the whole image edge to edge, no table edge, no frame, no border, no objects on it. No text, no letters, no numbers, no logos, no watermark. Soft even warm candlelight from the upper left, no strong vignette, no glare hotspots. Overall mid-dark tone, no large bright areas. The edges are plain continuous material. Photorealistic material texture, sharp fine detail, dark fantasy board-game style. Landscape 1536×1024.

### A2. `mat-dungeon.png` — Сокровищница темницы
> Deep crimson velvet cloth with a subtle damask quatrefoil pattern pressed into the pile, and in the center a gold-thread embroidered medallion: an eight-pointed star inside double rings bordered with small gold dots, the embroidery slightly raised and catching the light. Strict top-down orthographic view, the surface fills the whole image edge to edge, no table edge, no frame, no border, no objects on it. No text, no letters, no numbers, no logos, no watermark. Soft even warm candlelight from the upper left, no strong vignette, no glare hotspots. Overall mid-dark tone, no large bright areas. Any central emblem stays inside the central 45% of the width and 60% of the height; the edges are plain continuous material. Photorealistic material texture, sharp fine detail, dark fantasy board-game style. Landscape 1536×1024.

### A3. `mat-glade.png` — Поляна светлячков
> A soft carpet of lush deep-green moss with tiny white and yellow wildflowers and clover leaves, a faint ring of tiny pale mushrooms around the center (a fairy ring), and a few small softly glowing yellow-green fireflies resting on the moss. Strict top-down orthographic view, the surface fills the whole image edge to edge, no table edge, no frame, no border, no other objects. No text, no letters, no numbers, no logos, no watermark. Soft even warm light from the upper left, no strong vignette. Overall mid-dark tone, no large bright areas. The ring stays inside the central 45% of the width and 60% of the height; the edges are plain moss. Photorealistic, sharp fine detail, dark fantasy board-game style. Landscape 1536×1024.

### A4. `mat-forge.png` — Кузня подгорного короля
> A hammered dark steel plate with shallow hammer dimples and soot, heat-temper colors (straw, bronze and faint blue-violet) spreading softly from the center, rows of rivets near the top and bottom edges, and an engraved circle of abstract angular dwarven rune-like glyphs in the center with a faint orange ember glow inside the grooves. Strict top-down orthographic view, the surface fills the whole image edge to edge, no table edge, no frame, no border, no objects on it. No text, no letters, no numbers, no logos, no watermark. Soft even warm light from the upper left, no strong vignette, no glare hotspots. Overall mid-dark tone, no large bright areas. The emblem stays inside the central 45% of the width and 60% of the height. Photorealistic metal texture, sharp fine detail, dark fantasy board-game style. Landscape 1536×1024.

### A5. `mat-ice.png` — Ледяная цитадель
> A thick sheet of frozen ice seen from above: deep blue-teal depths, soft white frost patches, a few long natural cracks, tiny trapped air bubbles, and a large six-pointed snowflake carved into the ice in the center. Strict top-down orthographic view, the surface fills the whole image edge to edge, no table edge, no frame, no border, no objects on it. No text, no letters, no numbers, no logos, no watermark. Soft even cool light from the upper left, no strong vignette, no glare hotspots. Overall mid-dark tone, no large white areas. The snowflake stays inside the central 45% of the width and 60% of the height; the edges are plain ice. Photorealistic, sharp fine detail, dark fantasy board-game style. Landscape 1536×1024.

### A6. `mat-graveyard.png` — Кладбище горгулий
> A weathered dark-grey granite tomb slab made of several large stone blocks, with moss growing in the joints and cracks and pale lichen spots, and in the center a carved circle of abstract angular rune-like glyphs around a Celtic cross, all carved into the stone, not painted. Strict top-down orthographic view, the surface fills the whole image edge to edge, no table edge, no frame, no border, no objects on it. No text, no letters, no numbers, no logos, no watermark. Soft even dim light from the upper left, no strong vignette. Overall mid-dark tone, no large bright areas. The carving stays inside the central 45% of the width and 60% of the height. Photorealistic stone texture, sharp fine detail, dark fantasy board-game style. Landscape 1536×1024.

### A7. `mat-sky.png` — Небесная цитадель
> Polished dark storm-blue marble with bright white lightning-like veins, with an inlaid gold eight-pointed compass rose inside a thin gold ring in the center and a few tiny inlaid gold stars scattered around it. Strict top-down orthographic view, the surface fills the whole image edge to edge, no table edge, no frame, no border, no objects on it. No text, no letters, no numbers, no logos, no watermark. Soft even light from the upper left, no glare hotspots, no strong vignette. Overall dark tone, the marble stays dark. The compass stays inside the central 45% of the width and 60% of the height. Photorealistic, sharp fine detail, dark fantasy board-game style. Landscape 1536×1024.

### A8. `mat-cove.png` — Бухта гоблинов-пиратов
> An old pirate sea chart on aged dark-brown parchment: coastlines and islands drawn in faded brown ink, rhumb lines radiating from an ink compass rose in the center, a dashed red route ending with a red X mark, small ink wave marks in the sea, old fold creases and water stains. Absolutely no writing, no labels, no letters on the map. Strict top-down orthographic view, the parchment fills the whole image edge to edge, no torn edges, no frame, no border, no objects on it. Soft even warm candlelight from the upper left, no strong vignette. Overall mid-dark tone, the parchment is dark and old, not bright. The compass rose stays inside the central 45% of the width and 60% of the height. Photorealistic, sharp fine detail, dark fantasy board-game style. Landscape 1536×1024.

### A9. `mat-library.png` — Звёздная библиотека
> Deep navy-blue leather with fine grain and a gold-tooled celestial chart: concentric astrolabe rings with fine tick marks in the center, an elliptical orbit ring, a small gold eight-pointed star in the middle, constellations of tiny gold stars connected by thin gold lines further out, and scattered tiny gold dots like distant stars. Strict top-down orthographic view, the surface fills the whole image edge to edge, no table edge, no frame, no border, no objects on it. No text, no letters, no zodiac signs, no numbers, no logos, no watermark. Soft even warm light from the upper left, no strong vignette. Overall dark tone. The astrolabe stays inside the central 45% of the width and 60% of the height. Photorealistic, sharp fine detail, dark fantasy board-game style. Landscape 1536×1024.

### A10. `mat-oasis.png` — Оазис джинна
> A richly woven Persian-style carpet: a deep red field with a fine diamond lattice pattern and small floral motifs, a large indigo star-shaped central medallion with cream and gold outlines, plush woven pile texture, slightly worn in the middle. Strict top-down orthographic view, the carpet fills the whole image edge to edge, no fringe, no frame, no objects on it. No text, no letters, no numbers, no logos, no watermark. Soft even warm light from the upper left, no strong vignette. Overall mid-dark rich tone, no large bright areas. The medallion stays inside the central 45% of the width and 60% of the height. Photorealistic textile, sharp fine detail, dark fantasy board-game style. Landscape 1536×1024.

### A11. `mat-flooded.png` — Затопленная станция
> A wet dark steel diamond-tread floor plate (checker plate) with patches of orange rust, grime, and a few shallow dark puddles of water that faintly reflect the light. Strict top-down orthographic view, the surface fills the whole image edge to edge, no edge, no frame, no border, no objects on it. No text, no letters, no numbers, no logos, no watermark. Soft even dim light from the upper left, no strong vignette, no glare hotspots. Overall mid-dark tone. Photorealistic metal texture, sharp fine detail, dark fantasy board-game style. Landscape 1536×1024.

### A12. `mat-grove.png` — Грибная роща
> Dark forest-floor soil with bark chips and a few fallen leaves, crossed by a delicate network of thin glowing bioluminescent teal-green mycelium threads, and small clusters of softly glowing teal mushroom caps near the edges, with the center kept calmer and darker. Strict top-down orthographic view, the surface fills the whole image edge to edge, no frame, no border, no other objects. No text, no letters, no numbers, no logos, no watermark. Dim moody lighting, no strong vignette. Overall dark tone. Photorealistic, sharp fine detail, dark fantasy board-game style. Landscape 1536×1024.

### A13. `mat-koschei.png` — Логово Кощея
> Black polished volcanic stone like obsidian with faint reflections, a glowing emerald-green circle of abstract angular rune-like glyphs in the center with a soft green mist glow around it, and a fine gold zigzag ring inlaid around the runes with four small gold stars. Strict top-down orthographic view, the surface fills the whole image edge to edge, no edge, no frame, no border, no objects on it. No text, no letters, no numbers, no logos, no watermark. Soft even dim light from the upper left, no glare hotspots. Overall dark tone. The circle stays inside the central 45% of the width and 60% of the height. Photorealistic, sharp fine detail, dark fantasy board-game style. Landscape 1536×1024.

---

## B. Лобби-таверна (3 картинки)

Комната перед партией: игроки сидят вокруг овального стола, всё показано строго сверху. На стулья я ставлю портреты героев, перед каждым — кружка.

### B1. `tavern-table.png` — стол таверны сверху
> An oval tavern table seen strictly from directly above (top-down orthographic), made of six horizontal oak planks with dark seams, small iron nails near the plank ends, worn rounded edges, faint mug rings and light knife scratches, warm honey-brown wood. Nothing on the table. Transparent background around the table, no shadow. No text, no letters. Warm candlelight from the upper left, even lighting. Photorealistic, sharp detail. Landscape 1536×1024, the oval table fills about 90% of the width.

### B2. `chair.png` — стул сверху
> A rustic wooden tavern chair seen strictly from directly above (top-down orthographic): a square plank seat with rounded front corners, and the curved backrest rail with spindles at the BOTTOM of the image, so the chair faces the top of the image. Transparent background, no shadow. No text. Warm light from the upper left. Photorealistic, sharp detail. Square 1024×1024, the chair fills about 70% of the image.

### B3. `mug-top.png` — кружка сверху
> A wooden beer tankard with two iron hoops seen strictly from directly above (top-down orthographic): a round rim full of creamy foam, the handle pointing to the right. Transparent background, no shadow. No text. Warm light from the upper left. Photorealistic, sharp detail. Square 1024×1024, the tankard fills about 70% of the image.

---

## C. Рамы игрового стола (13 картинок)

Рама окружает поле. Её стороны растягиваются по размеру экрана, поэтому вдоль каждой стороны свет должен быть ровным, и все четыре стороны — одной толщины.

Хвост каждого промта этого раздела (уже вписан ниже):
*Square 1024×1024. Strict top-down view of a rectangular table frame like a thick picture frame, its outer edge touching the image edges. All four sides have the same thickness: 12% of the image width (about 120 px). Mitered corners with decorative metal corner brackets and rivets, and a thin trim strip along the inner edge. Inside the frame and outside it everything is fully transparent. Perfectly even lighting along each side, soft light from the upper left. No text, no objects. Photorealistic.*

### C1. `frame-oak.png` — Подземелье и таверна
> Frame beams of dark varnished oak with visible grain running along each side, forged black iron L-shaped corner brackets with rivets, a thin brass trim along the inner edge. Square 1024×1024. Strict top-down view of a rectangular table frame like a thick picture frame, its outer edge touching the image edges. All four sides have the same thickness: 12% of the image width (about 120 px). Mitered corners with decorative metal corner brackets and rivets, and a thin trim strip along the inner edge. Inside the frame and outside it everything is fully transparent. Perfectly even lighting along each side, soft light from the upper left. No text, no objects. Photorealistic.

### C2. `frame-ebony.png` — Сокровищница темницы
> Frame beams of glossy black ebony wood, blackened iron corner brackets with gold rivets, a thin gold trim along the inner edge. Square 1024×1024. Strict top-down view of a rectangular table frame like a thick picture frame, its outer edge touching the image edges. All four sides have the same thickness: 12% of the image width (about 120 px). Mitered corners with decorative metal corner brackets and rivets, and a thin trim strip along the inner edge. Inside the frame and outside it everything is fully transparent. Perfectly even lighting along each side, soft light from the upper left. No text, no objects. Photorealistic.

### C3. `frame-birch.png` — Поляна светлячков
> Frame made of birch logs with white bark and black horizontal marks, green-patina bronze corner brackets with rivets, a thin bronze trim along the inner edge, a few small tufts of moss. Square 1024×1024. Strict top-down view of a rectangular table frame like a thick picture frame, its outer edge touching the image edges. All four sides have the same thickness: 12% of the image width (about 120 px). Mitered corners with decorative metal corner brackets and rivets, and a thin trim strip along the inner edge. Inside the frame and outside it everything is fully transparent. Perfectly even lighting along each side, soft light from the upper left. No text, no objects. Photorealistic.

### C4. `frame-steel.png` — Кузня подгорного короля
> Frame made of dark riveted steel girders with soot, heavy black iron corner brackets with large rivets, a thin copper trim along the inner edge. Square 1024×1024. Strict top-down view of a rectangular table frame like a thick picture frame, its outer edge touching the image edges. All four sides have the same thickness: 12% of the image width (about 120 px). Mitered corners with decorative metal corner brackets and rivets, and a thin trim strip along the inner edge. Inside the frame and outside it everything is fully transparent. Perfectly even lighting along each side, soft light from the upper left. No text, no objects. Photorealistic.

### C5. `frame-ice.png` — Ледяная цитадель
> Frame made of translucent blue-white ice blocks with frost and small cracks, polished silver corner brackets with rivets, a softly glowing pale blue line along the inner edge. Square 1024×1024. Strict top-down view of a rectangular table frame like a thick picture frame, its outer edge touching the image edges. All four sides have the same thickness: 12% of the image width (about 120 px). Mitered corners with decorative metal corner brackets and rivets, and a thin trim strip along the inner edge. Inside the frame and outside it everything is fully transparent. Perfectly even lighting along each side, soft light from the upper left. No text, no objects. Photorealistic.

### C6. `frame-stone.png` — Кладбище горгулий
> Frame made of weathered grey granite blocks with moss in the joints, dark iron corner brackets with rivets, a thin darker stone trim along the inner edge. Square 1024×1024. Strict top-down view of a rectangular table frame like a thick picture frame, its outer edge touching the image edges. All four sides have the same thickness: 12% of the image width (about 120 px). Mitered corners with decorative metal corner brackets and rivets, and a thin trim strip along the inner edge. Inside the frame and outside it everything is fully transparent. Perfectly even lighting along each side, soft light from the upper left. No text, no objects. Photorealistic.

### C7. `frame-marble.png` — Небесная цитадель
> Frame made of polished white marble with fine grey veins, gold corner brackets with rivets, a thin gold trim along the inner edge. Square 1024×1024. Strict top-down view of a rectangular table frame like a thick picture frame, its outer edge touching the image edges. All four sides have the same thickness: 12% of the image width (about 120 px). Mitered corners with decorative metal corner brackets and rivets, and a thin trim strip along the inner edge. Inside the frame and outside it everything is fully transparent. Perfectly even lighting along each side, soft light from the upper left. No text, no objects. Photorealistic.

### C8. `frame-ship.png` — Бухта гоблинов-пиратов
> Frame made of dark tarred ship timber with worn grain, brass corner brackets with rivets, a thick twisted hemp rope running along the inner edge. Square 1024×1024. Strict top-down view of a rectangular table frame like a thick picture frame, its outer edge touching the image edges. All four sides have the same thickness: 12% of the image width (about 120 px). Mitered corners with decorative metal corner brackets and rivets, and the rope along the inner edge. Inside the frame and outside it everything is fully transparent. Perfectly even lighting along each side, soft light from the upper left. No text, no objects. Photorealistic.

### C9. `frame-mahogany.png` — Звёздная библиотека
> Frame made of polished dark red mahogany with deep lacquer shine, gold corner brackets with rivets, a thin gold inlay trim along the inner edge. Square 1024×1024. Strict top-down view of a rectangular table frame like a thick picture frame, its outer edge touching the image edges. All four sides have the same thickness: 12% of the image width (about 120 px). Mitered corners with decorative metal corner brackets and rivets, and a thin trim strip along the inner edge. Inside the frame and outside it everything is fully transparent. Perfectly even lighting along each side, soft light from the upper left. No text, no objects. Photorealistic.

### C10. `frame-sand.png` — Оазис джинна
> Frame made of carved warm sandstone with a shallow geometric pattern, gold corner brackets with rivets, a thin turquoise glazed tile trim along the inner edge. Square 1024×1024. Strict top-down view of a rectangular table frame like a thick picture frame, its outer edge touching the image edges. All four sides have the same thickness: 12% of the image width (about 120 px). Mitered corners with decorative metal corner brackets and rivets, and a thin trim strip along the inner edge. Inside the frame and outside it everything is fully transparent. Perfectly even lighting along each side, soft light from the upper left. No text, no objects. Photorealistic.

### C11. `frame-rust.png` — Затопленная станция
> Frame made of rusty riveted steel with orange rust streaks and wet dark patches, rusted iron corner brackets with rivets, a thin green-patina copper trim along the inner edge. Square 1024×1024. Strict top-down view of a rectangular table frame like a thick picture frame, its outer edge touching the image edges. All four sides have the same thickness: 12% of the image width (about 120 px). Mitered corners with decorative metal corner brackets and rivets, and a thin trim strip along the inner edge. Inside the frame and outside it everything is fully transparent. Perfectly even lighting along each side, soft light from the upper left. No text, no objects. Photorealistic.

### C12. `frame-bark.png` — Грибная роща
> Frame made of gnarled dark tree bark with deep furrows and patches of moss, green-patina bronze corner brackets with rivets, a softly glowing teal line along the inner edge. Square 1024×1024. Strict top-down view of a rectangular table frame like a thick picture frame, its outer edge touching the image edges. All four sides have the same thickness: 12% of the image width (about 120 px). Mitered corners with decorative metal corner brackets and rivets, and a thin trim strip along the inner edge. Inside the frame and outside it everything is fully transparent. Perfectly even lighting along each side, soft light from the upper left. No text, no objects. Photorealistic.

### C13. `frame-black.png` — Логово Кощея
> Frame made of black forged iron with a faint dark sheen, gold corner brackets with rivets, a softly glowing emerald-green line along the inner edge. Square 1024×1024. Strict top-down view of a rectangular table frame like a thick picture frame, its outer edge touching the image edges. All four sides have the same thickness: 12% of the image width (about 120 px). Mitered corners with decorative metal corner brackets and rivets, and a thin trim strip along the inner edge. Inside the frame and outside it everything is fully transparent. Perfectly even lighting along each side, soft light from the upper left. No text, no objects. Photorealistic.

---

## D. Интерфейс (10 картинок)

Из табличек я сделаю кнопки (на них будет надпись), балка — это шапка над столом, валики держат свиток летописи, остальное — лавка рынка.

### D1. `plate-iron.png` — обычная кнопка
> A blank plaque of dark forged iron with a slightly hammered raised bevelled rim and a smooth dark brushed-metal middle field. Front view, centered on a transparent background, canvas 1536×1024; the plaque is a horizontal rectangle with proportion 3:1 (about 1350×450 px) with slightly rounded corners and four small domed steel rivets placed near the corners inside the rim. The middle field is smooth, clean and evenly lit because text will be printed on it: no engraving, no text, no ornaments in the middle. Soft light from above, no room reflections. Photorealistic.

### D2. `plate-brass.png` — главная кнопка
> A blank plaque of polished brass with a raised bevelled rim and a smooth light golden brushed-metal middle field (dark text will be printed on it). Front view, centered on a transparent background, canvas 1536×1024; the plaque is a horizontal rectangle with proportion 3:1 (about 1350×450 px) with slightly rounded corners and four small domed brass rivets near the corners inside the rim. The middle field is smooth, clean and evenly lit: no engraving, no text, no ornaments in the middle, no dark blotches. Soft light from above, no room reflections. Photorealistic.

### D3. `plate-danger.png` — опасное действие
> A blank plaque of deep red enamel on iron: iron raised bevelled rim, smooth glossy dark-red enamel middle field. Front view, centered on a transparent background, canvas 1536×1024; the plaque is a horizontal rectangle with proportion 3:1 (about 1350×450 px) with slightly rounded corners and four small domed steel rivets near the corners inside the rim. The middle field is smooth, clean and evenly lit: no engraving, no text, no ornaments. Soft light from above, no room reflections. Photorealistic.

### D4. `plate-hero.png` — помощь и героические действия
> A blank plaque of green-patina bronze: bronze raised bevelled rim with verdigris, smooth deep-green enamel middle field. Front view, centered on a transparent background, canvas 1536×1024; the plaque is a horizontal rectangle with proportion 3:1 (about 1350×450 px) with slightly rounded corners and four small domed brass rivets near the corners inside the rim. The middle field is smooth, clean and evenly lit: no engraving, no text, no ornaments. Soft light from above, no room reflections. Photorealistic.

### D5. `beam.png` — балка шапки
> A long horizontal oak beam seen from the front: dark varnished wood with grain running along its length, forged black iron strap bands, each with two rivets, wrapped around the beam near both ends. The beam spans the whole width of a 1536×1024 canvas, is about 110 px tall and centered vertically; transparent background above and below. Lighting is perfectly even along the length. No text, no objects. Photorealistic.

### D6. `roller.png` — валик свитка
> A horizontal scroll roller seen from the side: a long roll of aged cream parchment wound on a wooden rod, with ornate turned brass finials at both ends. It spans the whole width of a 1536×1024 canvas, is about 100 px tall and centered vertically; transparent background. Light from above, even along the length. No text. Photorealistic.

### D7. `parchment.png` — пергамент (летопись, ценники, лист настроек)
> Seamless tileable texture of aged parchment paper: warm cream-beige with faint fibers, soft blotches and light stains spread evenly, no dark edges, no text, no drawings. Flat top-down view, even lighting. Square 1024×1024, tiles seamlessly in both directions.

### D8. `awning.png` — навес лавки рынка
> Front view of a merchant stall canopy valance: vertical stripes alternating deep red and cream canvas, each stripe ending at the bottom in a rounded scallop with a thin gold trim, exactly 8 scallops across the full width, gentle fabric folds and canvas weave. The valance occupies the top 40% of a 1536×1024 canvas; everything below the scallops is transparent. It must tile seamlessly from left to right. No text. Photorealistic.

### D9. `plank.png` — полка лавки
> Front view of a single long horizontal wooden shelf plank: dark worn wood with grain along the length, its thin top face visible as a lighter strip above the front face. It spans the whole width of a 1536×1024 canvas, is about 120 px tall and centered vertically; transparent background. Tiles seamlessly from left to right. No text, no objects. Photorealistic.

### D10. `boards.png` — задняя стенка лавки
> Seamless tileable texture of a dark wooden wall made of vertical planks with thin dark gaps between them, aged wood with knots, dim warm lighting. Square 1024×1024, tiles seamlessly in both directions. No objects, no text.

---

## E. Предметы на столе (16 картинок)

Предметы лежат на углах стола. Ракурс у всех одинаковый — три четверти сверху: камера наклонена примерно на 30° от вертикали, как будто смотришь на предмет, лежащий на столе.

Хвост каждого промта этого раздела (уже вписан ниже):
*Single object centered, filling about 80% of a square 1024×1024 image. Three-quarter view from above (camera about 30 degrees from vertical, as if looking down at an object lying on a table). Warm candlelight from the upper left. Transparent background, no shadow, no table surface, no other objects, no text. Photorealistic dark fantasy board-game prop.*

### E1. `candles.png`
> A cluster of three white pillar candles of different heights on a round dark stone plate, with old wax drips; the candles are NOT lit, the black wicks are clearly visible on top. Single object centered, filling about 80% of a square 1024×1024 image. Three-quarter view from above (camera about 30 degrees from vertical, as if looking down at an object lying on a table). Warm candlelight from the upper left. Transparent background, no shadow, no table surface, no other objects, no text. Photorealistic dark fantasy board-game prop.

### E2. `coins.png`
> A small pile of old gold coins with two short stacks and a few loose coins, worn stamped faces without letters. Single object centered, filling about 80% of a square 1024×1024 image. Three-quarter view from above (camera about 30 degrees from vertical, as if looking down at an object lying on a table). Warm candlelight from the upper left. Transparent background, no shadow, no table surface, no other objects, no text. Photorealistic dark fantasy board-game prop.

### E3. `dice.png`
> Two old ivory six-sided dice with black pips, one slightly tilted against the other. Single object centered, filling about 80% of a square 1024×1024 image. Three-quarter view from above (camera about 30 degrees from vertical, as if looking down at an object lying on a table). Warm candlelight from the upper left. Transparent background, no shadow, no table surface, no other objects, no text. Photorealistic dark fantasy board-game prop.

### E4. `goblet.png`
> An ornate silver-and-gold goblet with a small red gem, filled with dark red wine. Single object centered, filling about 80% of a square 1024×1024 image. Three-quarter view from above (camera about 30 degrees from vertical, as if looking down at an object lying on a table). Warm candlelight from the upper left. Transparent background, no shadow, no table surface, no other objects, no text. Photorealistic dark fantasy board-game prop.

### E5. `dagger.png`
> A dagger lying diagonally, steel blade, leather-wrapped grip and a brass crossguard. Single object centered, filling about 80% of a square 1024×1024 image. Three-quarter view from above (camera about 30 degrees from vertical, as if looking down at an object lying on a table). Warm candlelight from the upper left. Transparent background, no shadow, no table surface, no other objects, no text. Photorealistic dark fantasy board-game prop.

### E6. `potion.png`
> A round glass potion flask with a cork stopper, filled with softly glowing red liquid. Single object centered, filling about 80% of a square 1024×1024 image. Three-quarter view from above (camera about 30 degrees from vertical, as if looking down at an object lying on a table). Warm candlelight from the upper left. Transparent background, no shadow, no table surface, no other objects, no text. Photorealistic dark fantasy board-game prop.

### E7. `book.png`
> A closed old spellbook in dark leather with metal corner caps and a clasp, no writing on the cover. Single object centered, filling about 80% of a square 1024×1024 image. Three-quarter view from above (camera about 30 degrees from vertical, as if looking down at an object lying on a table). Warm candlelight from the upper left. Transparent background, no shadow, no table surface, no other objects, no text. Photorealistic dark fantasy board-game prop.

### E8. `scroll.png`
> A rolled parchment scroll lying horizontally, tied with a red ribbon and a red wax seal without letters. Single object centered, filling about 80% of a square 1024×1024 image. Three-quarter view from above (camera about 30 degrees from vertical, as if looking down at an object lying on a table). Warm candlelight from the upper left. Transparent background, no shadow, no table surface, no other objects, no text. Photorealistic dark fantasy board-game prop.

### E9. `mug.png`
> A wooden beer tankard with iron hoops and a handle, full of creamy foam. Single object centered, filling about 80% of a square 1024×1024 image. Three-quarter view from above (camera about 30 degrees from vertical, as if looking down at an object lying on a table). Warm candlelight from the upper left. Transparent background, no shadow, no table surface, no other objects, no text. Photorealistic dark fantasy board-game prop.

### E10. `hammer.png`
> A blacksmith hammer with a heavy iron head and a worn wooden handle, lying on its side. Single object centered, filling about 80% of a square 1024×1024 image. Three-quarter view from above (camera about 30 degrees from vertical, as if looking down at an object lying on a table). Warm candlelight from the upper left. Transparent background, no shadow, no table surface, no other objects, no text. Photorealistic dark fantasy board-game prop.

### E11. `coals.png`
> A small heap of glowing coals and embers in a shallow iron dish, orange glow inside the cracks. Single object centered, filling about 80% of a square 1024×1024 image. Three-quarter view from above (camera about 30 degrees from vertical, as if looking down at an object lying on a table). Transparent background, no shadow, no table surface, no other objects, no text. Photorealistic dark fantasy board-game prop.

### E12. `crystals.png`
> A cluster of pale blue ice crystals growing from a small frosted rock base. Single object centered, filling about 80% of a square 1024×1024 image. Three-quarter view from above (camera about 30 degrees from vertical, as if looking down at an object lying on a table). Cool soft light from the upper left. Transparent background, no shadow, no table surface, no other objects, no text. Photorealistic dark fantasy board-game prop.

### E13. `mushrooms.png`
> A small cluster of forest mushrooms with softly glowing teal caps growing from a piece of mossy wood. Single object centered, filling about 80% of a square 1024×1024 image. Three-quarter view from above (camera about 30 degrees from vertical, as if looking down at an object lying on a table). Transparent background, no shadow, no table surface, no other objects, no text. Photorealistic dark fantasy board-game prop.

### E14. `keys.png`
> An iron ring with four old skeleton keys of different shapes. Single object centered, filling about 80% of a square 1024×1024 image. Three-quarter view from above (camera about 30 degrees from vertical, as if looking down at an object lying on a table). Warm candlelight from the upper left. Transparent background, no shadow, no table surface, no other objects, no text. Photorealistic dark fantasy board-game prop.

### E15. `lamp.png`
> An ornate brass oil lamp of the genie kind with a long spout pointing to the right; NOT lit, the wick is visible at the tip of the spout. Single object centered, filling about 80% of a square 1024×1024 image. Three-quarter view from above (camera about 30 degrees from vertical, as if looking down at an object lying on a table). Warm candlelight from the upper left. Transparent background, no shadow, no table surface, no other objects, no text. Photorealistic dark fantasy board-game prop.

### E16. `egg.png`
> An ornate golden egg covered in fine filigree, resting on a small dark stand. Single object centered, filling about 80% of a square 1024×1024 image. Three-quarter view from above (camera about 30 degrees from vertical, as if looking down at an object lying on a table). Warm candlelight from the upper left. Transparent background, no shadow, no table surface, no other objects, no text. Photorealistic dark fantasy board-game prop.

---

## Что делать с готовыми картинками

1. Сохраните каждую картинку в PNG под её именем из заголовка (`mat-default.png`, `frame-oak.png`, `candles.png` и т. д.).
2. Пришлите их в чат с Claude — можно архивом или по нескольку штук.
3. Остальное Claude сделает сам: обрежет, выровняет яркость под текст, вырежет фон, если он не прозрачный, разрежет рамы и таблички по 9 частям, сделает облегчённые версии для телефонов, расставит пламя на свечах и подключит всё в игру.

Если кредитов мало, начните с раздела **A** (поля стола) и **B** (лобби) — они заметнее всего.
