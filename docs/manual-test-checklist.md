# Fişlik — Yayın Öncesi Manuel Test Kontrol Listesi

Bu liste, otomatik test paketinin (390 test, `npx jest` yeşil) veremeyeceği
kanıtı toplamak için var: gerçek bir telefonda, gerçek işletim sistemi
davranışıyla, gerçek ağ koşullarında ne olduğu. Otomatik testler zaten
kanıtladığı şeyleri burada tekrar sormuyoruz (ör. "buton doğru metni
gösteriyor mu" gibi maddeler yok — 390 test bunu kanıtlıyor). Buradaki her
madde ya bir cihaz/işletim sistemi davranışı ya da arka uçla gerçek bir ağ
üzerinden konuşan bir uçtan uca akış.

**Dil notu:** Bu belge Türkçe yazıldı çünkü test eden kişi uygulamanın Türkçe
arayüz metnini okuyup karşılaştıracak (ör. "İnternet bağlantısı yok",
"Sıraya alındı"); doğru/yanlış kararını Türkçe kopyayla eşleştirerek verecek.
Kod ve diğer belgeler İngilizce kalmaya devam ediyor.

**Kapsam:** Aksi belirtilmedikçe her madde **hem iOS hem Android**'de
çalıştırılır. Gerçek cihaz kullanın — simülatör/emülatör kamera, biyometri ve
bildirim davranışlarının çoğunu gerçekçi taklit etmez.

**Ortam:** `fislik-api`'yi `docker compose up` ile lokalde çalıştırıp
`EXPO_PUBLIC_API_URL`'i ona yönlendirin. En az iki hesaba ihtiyacınız var: bir
mükellef (client) ve bir muhasebeci (accountant) — ikisi de gerçek, ayrı
cihazlarda (veya aynı cihazda sırayla) oturum açabilmeli.

Her düzeltme kendi commit'i olsun. Herhangi bir madde başarısızken teslim
etmeyin.

---

## 1. Kayıt, davet kabulü ve oturum

- [ ] Yeni bir mükellef hesabı kaydet. Beklenen: kayıt sonrası firma bilgileri
      adımı görünür (mükellef için), atlanabilir ("Şimdilik geç").
- [ ] Mükellef tarafında bir muhasebeci daveti kabul et (davet linki veya
      uygulama içi kart üzerinden). Beklenen: "Muhasebecim" listesinde yeni
      ilişki görünür.
- [ ] Muhasebeci tarafında bir mükellef daveti kabul et. Beklenen: mükellef
      istemci listesinde belirir.
- [ ] Çıkış yap, tekrar giriş yap. Beklenen: fiş/istemci listesi doğru rolle
      geri gelir.
- [ ] Uygulamayı tamamen kapat (force quit), yeniden aç. Beklenen: oturum
      hayatta kalır, giriş ekranına düşmez.

## 2. Biyometrik kilit — iki kilitlenme tuzağı dahil

- [ ] Ayarlardan biyometrik kilidi aç. Uygulamayı force quit edip yeniden aç.
      Beklenen: açılışta biyometri istemi (Face ID / Touch ID / parmak izi)
      çıkar.
- [ ] İstemi **iptal et** (Face ID/Touch ID diyaloğunu kapat, doğrulama
      yapmadan). Beklenen: kilit ekranı kalır ve bir "çıkış yap" seçeneği
      sunar — uygulama sonsuza dek donmuş bir ekranda kalmaz.
- [ ] Cihazda biyometri **etkin ama hiç kayıtlı parmak/yüz yok** olan bir
      durumu test et (ayarlardan tüm Face ID/Touch ID/parmak izi kayıtlarını
      sil, biyometri özelliği açık kalsın). Beklenen: uygulama bunu makul
      şekilde ele alır (kilitlenip çıkışa yönlendirir veya biyometriyi
      devre dışı gösterir) — sonsuz döngüye ya da beyaz ekrana düşmez.
- [ ] Kilit ekranının görsel render'ını gözle kontrol et (spacing, buton
      hizası) — otomatik testler sadece davranışı doğruluyor, pikselleri
      değil.

## 3. Kamera — seri çekim

- [ ] Kamera ekranından **beş fiş art arda, ekrandan ayrılmadan** çek.
      Beklenen: hepsi "Yükleniyor" olarak listeye düşer, hiçbiri diğerinin
      sıkıştırmasını (compression) beklerken deklanşörü kilitlemez — beşinci
      çekim de ilk kadar hızlı tetiklenir.
- [ ] Aynı ekranda galeri ve ataç (dosya seç) butonlarına art arda hızlı
      dokun. Beklenen: çift kayıt oluşmaz.
- [ ] Gerçek bir telefon kamerasıyla çekilen bir fişi yükle. Beklenen:
      sıkıştırma sonrası dosya boyutu 15 MB sınırının belirgin şekilde
      altında (uygulama 1600px/0.7 kalitede sıkıştırıyor; tipik bir fiş
      fotoğrafı birkaç MB'ı geçmemeli).
- [ ] Çekim sonrası, yükleme tamamlanmadan uygulamayı force quit et.
      Yeniden aç. Beklenen: dosya kuyrukta kalır ve yükleme devam
      eder/yeniden dener — kaybolmaz.

## 4. Çevrimdışı yükleme kuyruğu — uygulamanın en kritik davranışı

Bunu hiçbir otomatik test cihaz üzerinde kanıtlayamaz; bu yüzden listenin en
önemli maddesi budur.

- [ ] Telefonu **uçak moduna** al.
- [ ] Uçak modundayken **üç fiş çek**. Beklenen: hepsi "Yükleniyor" durumunda
      kuyruğa girer, hata göstermez (henüz yükleme denemesi başarısız olarak
      işaretlenmez).
- [ ] Uçak modundayken uygulamayı **force quit** et.
- [ ] Uygulamayı **yeniden aç** (hâlâ uçak modunda). Beklenen: üç kayıt
      kuyrukta görünmeye devam eder, kaybolmamıştır.
- [ ] **Ağ bağlantısını geri aç** (uçak modunu kapat). Uygulamayla hiçbir
      şekilde etkileşime girmeden bekle. Beklenen: üç fiş de **kullanıcı
      hiçbir şey yapmadan** kendiliğinden yüklenir ve gerçek fişlere
      (analiz sonucu/kuyruk durumu ile) dönüşür.
- [ ] Bu senaryoyu bir kez de "çekim sonrası anında force quit, ağ hep açık"
      varyasyonuyla tekrarla — kuyruk sadece uçak modu senaryosuna değil,
      genel olarak beklenmedik kapanmaya dayanıklı olmalı.

## 5. Ağ hataları

- [ ] Uygulamayı ulaşılamayan bir API adresine yönlendir (ör. yanlış
      `EXPO_PUBLIC_API_URL` veya API'yi durdurup istek at). Beklenen: hata
      metni tam olarak **"İnternet bağlantısı yok"** okur — genel/teknik bir
      hata değil.

## 6. Fiş düzenleme (extraction editor)

- [ ] Bir fişin tüm alanlarını düzenle: vergi kimlik no (VKN/TCKN), ödeme
      yöntemi, kategori dahil tüm on iki alan. Beklenen: kaydet, geri dön,
      tekrar aç — değerler kalıcı.
- [ ] Başarısız (Başarısız/error durumunda) bir analizi "yeniden dene" ile
      tetikle. Beklenen: analiz yeniden kuyruğa girer ve sonuçlanır.
- [ ] Hiçbir alanı değiştirmeden kaydet. Beklenen: sunucuya boş bir PATCH
      gitmez (bu, sunucu tarafında `edited_by` işaretleyip yeniden analizi
      kalıcı olarak engeller — bkz. §11 Bilinen Sınırlamalar).

## 7. PDF yükleme ve önizleme

- [ ] Dosyalar (Files) uygulamasından bir PDF fiş yükle (galeri değil, dosya
      seçici). Beklenen: PDF, uygulama içinde satır içi (inline) önizlenir —
      indirilmeye zorlamaz.
- [ ] Bir fişi açık bırakıp **bir saatten fazla bekle** (ya da sunucu tarafında
      presign süresini test amaçlı kısalt), sonra tekrar aç/yenile. Beklenen:
      süresi dolmuş bir görsel/PDF linki için açık bir "yüklenemedi, tekrar
      dene" durumu görünür — boş kutu veya sessiz kırılma yok. (Presigned
      URL'ler sunucu tarafında 1 saat sonra süresi doluyor.)

## 8. Ay kilitleme (locked months)

- [ ] Muhasebeci hesabıyla mevcut ayı **kilitle**.
- [ ] Mükellef hesabıyla o ay için yeni bir fiş yükle. Beklenen: fiş
      reddedilmez; **bir sonraki açık aya** düşer.
- [ ] Hem eski (kilitli) ay hem yeni ay ekranlarını kontrol et. Beklenen: her
      ikisi de otomatik yenilenir — kilitli ayda fiş görünmez, yeni ayda
      görünür, elle yenilemeye gerek kalmaz.
- [ ] Ay kilidini aç. Beklenen: kilit açma onay istemez (kilitleme onay ister,
      kilit açma istemez — bu asimetri kasıtlı).

## 9. Ertelenen fiş (deferred receipt, `extraction === null`)

- [ ] Aylık analiz hakkı dolmuş durumda bir fiş yükle (veya bu duruma düşmüş
      mevcut bir fişi aç). Beklenen: ekran **"Bu ayın analiz hakkı
      doldu…"** benzeri bir metin gösterir — boş/kırık bir form değil. Bu
      durum "veri eksik" değil, "gelecek ay analiz edilecek" anlamına gelir.

## 10. Muhasebeci akışları

- [ ] Bir fişi **tek tek** "işlendi" olarak işaretle. Beklenen: durum güncellenir.
- [ ] **Tümünü işlendi yap** (bulk mark) kullan, ardından bir tanesini geri al
      (unmark). Beklenen: liste ve rozet sayıları tutarlı kalır.
- [ ] Muhasebeci olarak bir mükellef **adına** fiş yükle (upload on behalf).
      Beklenen: fiş doğru mükellefin listesine düşer, kamerada "... için
      çekiliyor" bandı görünür.
- [ ] Bir fişte **sorun bildir** (report an issue). Beklenen: mükellef
      tarafında "Sorun var" rozeti/bildirimi görünür.
- [ ] **ZIP dışa aktarımı**: bir mükellefin aylık arşivini indir, paylaşım
      ekranına (share sheet) düşür. Beklenen: paylaşım sayfası açılır ve
      indirilen ZIP **gerçekten geçerli bir arşiv** (aç, içindeki dosyaları
      kontrol et — bozuk/boş değil).

## 11. Sorun bildirme / çözme — rol ayrımı

API bunu role göre kısıtlıyor: sorunu **muhasebeci açar**, **mükellef
kapatır**. İkisini de gerçek hesaplarla doğrulayın.

- [ ] Muhasebeci bir fişte sorun bildirir.
- [ ] Mükellef aynı fişi açar ve sorunu **çözer** (resolve). Beklenen: işlem
      başarılı olur (403 almaz).
- [ ] Muhasebeci ekranında sorunun kapandığını doğrula — **ekranı yenileyerek**
      (bkz. §13 Bilinen Sınırlamalar: otomatik yenilenmeyebilir).
- [ ] Muhasebeci tarafında resolve seçeneğinin **olmadığını** doğrula (bu
      kasıtlı — mükellefin işi).

## 12. Derin bağlantılar (deep links)

- [ ] `/davet/:token` linkini Mail/Gmail gibi bir uygulamadan, **uygulama
      telefonda kuruluyken** aç. Beklenen: doğrudan davet ekranına düşer,
      tarayıcıya değil.
- [ ] Aynı linki **uygulama kurulu değilken** aç. Beklenen: tarayıcıda web
      sürümüne düşer (uygulama mağaza sayfasına yönlendirme varsa onu da
      kontrol et).
- [ ] `/sifre-sifirla/:token` linkini de aynı iki senaryoda test et.
- [ ] **Not:** Bu linklerin uygulamayı otomatik açması (universal
      links/App Links) `fislik-web`'in `apple-app-site-association` (iOS) ve
      `assetlinks.json` (Android) dosyalarını doğru içerikle yayınlamasına
      bağlı — bu, `fislik-web` reposunda ayrı bir takip işi. O dosyalar
      yayınlanmadan bu madde tarayıcıya düşmekle sonuçlanabilir; bu bir
      mobil uygulama hatası değildir.

## 13. İzin reddi

Her iki platformda da **ilk reddetme** ile **kalıcı reddetme** farklı
davranır — ikisini de ayrı ayrı test edin.

- [ ] Kamera izni istemini **ilk kez** reddet. Beklenen: uygulama içinde
      tekrar izin isteyebileceğin bir yol var (sistem izin diyaloğu tekrar
      çıkabilir).
- [ ] Kamera iznini **kalıcı olarak reddet** (iOS: "Don't Allow" sonrası
      tekrar sorulmaz; Android: "Bir daha sorma" işaretiyle reddet).
      Beklenen: uygulama "Ayarları aç" gibi bir buton gösterir ve bu buton
      gerçekten cihazın Ayarlar > Fişlik izin ekranına götürür.
- [ ] Aynı iki senaryoyu galeri/fotoğraf izni için de tekrarla.

## 14. Görsel / erişilebilirlik

- [ ] Uygulama simgesini gerçek cihazda kontrol et: iOS'ta köşeleri
      yuvarlatılmış kare maske, Android'de dairesel/kare/damla gibi farklı
      OEM maskeleri (mümkünse birden fazla launcher/OEM'de). Beklenen: marka
      simgesi (Fişlik amblemi) her maskede orantılı ve okunur görünür, kenara
      yapışık veya minik değil.
- [ ] En küçük desteklenen ekranda (iPhone SE) uygulamayı gez. Beklenen: hiçbir
      kritik buton/metin kırpılmıyor, taşmıyor, dokunma hedefleri erişilebilir.
- [ ] Cihazda **sistem yazı tipi boyutunu büyüt** (Ayarlar > Erişilebilirlik >
      Metin Boyutu). Beklenen: metinler taşarak butonları/ekranı bozmuyor,
      okunabilir kalıyor.

---

## Bilinen sınırlamalar (bunlar hata değil, bekleyin)

Test eden kişinin "hata buldum" sanmaması için önceden kabul edilmiş
sınırlar:

- **Sorun çözme rozeti anında güncellenmez.** Mükellef bir sorunu çözdüğünde,
  muhasebecinin ekranındaki "Sorun var" rozeti bir push bildirim kanalı
  olmadığı için **kendiliğinden temizlenmez** — muhasebeci ekranı yeniden
  çekene (yenileyene/tekrar açana) kadar eski rozet görünmeye devam
  edebilir. Muhasebeci `issue_resolved` bildirimini alır, ama liste
  rozeti otomatik yenilenmez.
- **Çökme ekranının kendisi çökerse** (CrashScreen bileşeni içinde bir hata
  oluşursa), uygulamada tek bir hata sınırı (error boundary) olduğu için bu
  React Native'in varsayılan kırmızı hata ekranına düşer — Fişlik'in kendi
  "Bir şeyler ters gitti" ekranına değil. Bu beklenen bir davranıştır, ikinci
  bir sınır yoktur.
- **Presigned URL'ler 1 saat sonra süresi doluyor** (§7). Bir fişi uzun süre
  açık tutup görsel/PDF'i tekrar yüklemeye çalışmak "yüklenemedi" durumuna
  düşebilir; bu bir hata değil, tasarım gereği.
- **Android 13+ monokrom (themed) simge** eklenmedi — isteğe bağlı bir
  iyileştirme olarak bilinçli şekilde ertelendi, launcher'da varsayılan renkli
  simge görünür.
- **Mağaza listeleme varlıkları** (ekran görüntüleri, feature graphic, gizlilik
  politikası URL'si) ve **EAS submit** kimlik bilgileri/proje bağlama bu
  listenin kapsamı dışında — ayrı, insan onayı gereken bir iş.

---

## Kaynak

Bu liste iki yerden geliyor:

1. `.superpowers/sdd/2026-08-07-fislik-mobil/task-29-brief.md` — görev
   tanımındaki zorunlu maddeler.
2. `.superpowers/sdd/2026-08-07-fislik-mobil/progress.md` — 29 görev
   boyunca biriken "cihazda doğrulanmadı" notları (Task 8 biyometri, Task 14
   kamera/izin, Task 17 presign süresi, Task 19 klavye davranışı, Task 25
   rozet gecikmesi, Task 27 tek hata sınırı, Task 28 simge/mağaza varlıkları).
