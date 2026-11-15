#!/usr/bin/env python3
"""Catalogo de skins clasicos del Winamp Skin Museum (skins.webamp.org) para buscar sin salir del servidor.

Baja SOLO los datos (nombre de archivo, md5, descripcion) de todos los skins clasicos por la API publica
del museo, descarta los +18 (los que el museo marca y los que tienen palabras explicitas), los categoriza
por palabras clave y arma data/skins.db (SQLite + FTS5). Los archivos .wsz y las capturas NO se bajan
aqui: el servidor los pide al museo recien cuando alguien elige uno (ver server.py).

Uso: make skins   (o: python scripts/skins_index.py [ruta/skins.db])
     Unos 8 minutos; se puede volver a correr para actualizar. Por defecto escribe en la carpeta de
     configuracion (la misma de la clave), donde el servidor lo busca.
"""
import json, re, sqlite3, sys, time, urllib.request
from pathlib import Path

API = "https://api.webamp.org/graphql"
PAGE = 500

# Palabras que excluyen un skin aunque el museo no lo haya marcado +18 (se buscan en nombre y descripcion)
NSFW = re.compile(r"\b(nsfw|xxx+|porn\w*|pr0n|hentai|ecchi|nude\w*|nudity|naked|sex\w*|boob\w*|tits?|titties|"
                  r"pussy|penis|dick|cock|vagina|nipples?|erotic\w*|playboy|playmate|hustler|stripper|strip\s?tease|"
                  r"lingerie|bikini|topless|fetish|bdsm|milf|hooters|orgasm\w*|horny|slut|whore|bitch|fuck\w*|"
                  r"18\+|adults? only|x-rated|nazi\w*|hitler|kkk|swastika)\b", re.I)

# Categorias (nombre visible -> palabras clave). Un skin puede tener varias.
CATS = {
    "Anime": r"anime|manga|dragon ?ball|dbz|goku|vegeta|naruto|sasuke|one ?piece|luffy|bleach|evangelion|\beva\b|gundam|"
             r"sailor ?moon|pokemon|pok[eé]mon|pikachu|digimon|yu-?gi-?oh|inuyasha|ranma|cowboy ?bebop|ghost in the shell|"
             r"akira|totoro|ghibli|miyazaki|chobits|lain|trigun|hellsing|fullmetal|death ?note|card ?captor|sakura|"
             r"tenchi|slayers|macross|robotech|lupin|saint seiya|caballeros del zodiaco|hamtaro|hello kitty|kawaii|"
             r"azumanga|love ?hina|neon genesis|rei ayanami|asuka|ayanami|utena|escaflowne|outlaw star|berserk|"
             r"fruits basket|yu yu hakusho|rurouni|kenshin|initial d|hikaru|chibi|otaku|tokyo|j-?pop",
    "Películas": r"movie|film|cinema|matrix|neo\b|star ?wars|jedi|sith|vader|yoda|lord of the rings|\blotr\b|tolkien|hobbit|"
                 r"harry potter|hogwarts|terminator|alien|predator|jurassic|titanic|batman|superman|spider-?man|"
                 r"x-?men|wolverine|hulk|iron ?man|avengers|marvel|dc comics|indiana jones|back to the future|"
                 r"blade ?runner|tron\b|ghostbusters|james bond|007|men in black|pulp fiction|tarantino|kill bill|"
                 r"pirates of the caribbean|shrek|toy story|pixar|disney|lion king|nemo|monsters inc|ice age|"
                 r"fight club|donnie darko|nightmare before christmas|tim burton|jaws|rocky|scarface|godfather|"
                 r"chucky|freddy|jason|halloween|scream|resident evil|underworld|blade\b|hellboy|x-files|"
                 r"independence day|armageddon|gladiator|300\b|sin city|v for vendetta|transformers|"
                 r"planet of the apes|stargate|dune\b|robocop|mad max|e\.?t\.?\b|gremlins|goonies|labyrinth",
    "Series y TV": r"simpsons|homer|bart|futurama|south park|family guy|friends\b|seinfeld|x-?files|star ?trek|"
                   r"enterprise|klingon|borg|doctor who|tardis|buffy|charmed|lost\b|24\b|sopranos|"
                   r"twin peaks|babylon ?5|farscape|firefly|smallville|scrubs|the office|beavis|daria|"
                   r"king of the hill|mtv|cartoon network|nickelodeon|spongebob|bob esponja|rugrats|"
                   r"dexter|powerpuff|johnny bravo|courage|ed edd|invader zim|samurai jack|teen titans|"
                   r"looney|bugs bunny|tom and jerry|scooby|flintstones|jetsons|garfield|snoopy|peanuts|"
                   r"muppets|sesame|teletubbies|power rangers|tmnt|ninja turtles|thundercats|he-?man|"
                   r"transformers|g\.?i\.? joe|smurfs|pitufos|care bears|my little pony|doug\b|hey arnold|"
                   r"animaniacs|pinky and the brain|ren and stimpy|aqua teen|adult swim|sealab|harvey birdman",
    "Videojuegos": r"game|gaming|gamer|zelda|link\b|hyrule|mario|luigi|nintendo|sega|sonic|playstation|\bps2?\b|xbox|"
                   r"quake|doom|half-?life|counter-?strike|\bcs\b|unreal|starcraft|warcraft|diablo|blizzard|"
                   r"final fantasy|\bff\d|chrono|metroid|samus|castlevania|mega ?man|street fighter|mortal kombat|"
                   r"tekken|metal gear|snake\b|tomb raider|lara croft|resident evil|silent hill|deus ex|"
                   r"the sims|simcity|pac-?man|tetris|atari|commodore|amiga|c64|arcade|nes\b|snes|n64|gameboy|"
                   r"game boy|kirby|donkey kong|starfox|pokemon|counterstrike|warhammer|everquest|ultima|"
                   r"command (and|&) conquer|red alert|age of empires|max payne|gta\b|grand theft|halo\b|"
                   r"fallout|baldur|neverwinter|myst\b|monkey island|lucasarts|duke nukem|wolfenstein",
    "Música": r"music|band|metal|rock|punk|hip ?hop|rap\b|techno|trance|house\b|dj\b|guitar|drum|bass|"
              r"metallica|nirvana|linkin park|korn|slipknot|marilyn manson|rammstein|iron maiden|ac/?dc|"
              r"pink floyd|beatles|led zeppelin|queen\b|radiohead|coldplay|u2\b|red hot chili|green day|"
              r"blink[- ]?182|offspring|limp bizkit|system of a down|tool\b|nine inch nails|nin\b|depeche mode|"
              r"daft punk|prodigy|chemical brothers|moby|aphex|bjork|madonna|britney|eminem|2pac|tupac|"
              r"dr\.? dre|snoop|50 cent|michael jackson|elvis|bob marley|reggae|jazz|blues|classical|mozart|"
              r"beethoven|kiss\b|ozzy|black sabbath|slayer|megadeth|pantera|sepultura|in flames|children of bodom|"
              r"nightwish|hammerfall|blind guardian|manowar|dream theater|the cure|smiths|oasis|blur\b|"
              r"gorillaz|weezer|foo fighters|pearl jam|soundgarden|alice in chains|deftones|disturbed|"
              r"evanescence|avril|shakira|backstreet|nsync|spice girls|abba|bon jovi|guns n|gnr\b|aerosmith",
    "Deportes": r"sport|football|soccer|f[uú]tbol|nba|nfl|nhl|mlb|basket|baseball|hockey|tennis|golf|"
                r"formula ?1|\bf1\b|ferrari|nascar|racing|skate|snowboard|surf|bmx|wrestling|wwf|wwe|"
                r"boxing|olympic|real madrid|barcelona|manchester|juventus|chelsea|liverpool|arsenal|"
                r"boca|river plate|world cup|mundial|lakers|bulls|jordan",
    "Autos y motos": r"\bcar\b|cars\b|auto\b|motor|mustang|porsche|bmw|mercedes|audi|volkswagen|vw\b|subaru|"
                     r"nissan|skyline|toyota|honda|mazda|mitsubishi|lamborghini|corvette|chevrolet|chevy|"
                     r"dodge|viper|harley|ducati|yamaha|kawasaki|suzuki|motorcycle|turbo|tuning|nitro",
    "Ciencia ficción y espacio": r"space|nasa|galaxy|planet|star\b|stars\b|cosmic|cosmos|orbit|rocket|alien|ufo|"
                                 r"sci-?fi|cyber|cyberpunk|robot|android|mech|future|futuristic|matrix|tron\b",
    "Naturaleza y animales": r"nature|forest|tree|flower|ocean|sea\b|water|beach|sunset|mountain|winter|snow|"
                             r"autumn|spring|summer|rain|animal|cat\b|cats\b|dog\b|dogs\b|wolf|tiger|lion|"
                             r"dragon|horse|bird|fish|dolphin|whale|panda|penguin|frog|butterfly|bear\b",
    "Tecnología y marcas": r"windows|microsoft|xp\b|vista|apple|mac\b|macos|aqua\b|ipod|itunes|linux|tux|"
                           r"ubuntu|debian|beos|amiga|nokia|sony|walkman|discman|panasonic|technics|pioneer|"
                           r"coca-?cola|pepsi|nike|adidas|mcdonald|intel|amd\b|nvidia|geforce|radeon",
    "Comics y superhéroes": r"comic|batman|superman|spider-?man|x-?men|wolverine|hulk|iron ?man|captain america|"
                            r"marvel|dc comics|joker|catwoman|wonder woman|flash\b|green lantern|spawn|"
                            r"punisher|daredevil|venom|deadpool|witchblade|tank girl|calvin and hobbes|dilbert",
    "Clásicos de Winamp": r"winamp|nullsoft|base[- ]?2|classified|bento|llama|whips the llama",
}
FROM_README = {"Anime", "Películas", "Series y TV", "Videojuegos", "Música", "Comics y superhéroes"}
CAT_RE = {k: re.compile(r"(?<![a-z])(?:" + v + r")(?![a-z])", re.I) for k, v in CATS.items()}


def query(q: str) -> dict:
    req = urllib.request.Request(API, data=json.dumps({"query": q}).encode(),
                                 headers={"Content-Type": "application/json", "User-Agent": "offline-player-skin-index"})
    for tries in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)["data"]
        except Exception as exc:  # noqa: BLE001
            if tries == 4:
                raise
            print("reintento:", exc, file=sys.stderr)
            time.sleep(5 * (tries + 1))
    return {}


def nice(filename: str) -> str:
    n = re.sub(r"\.(wsz|zip)$", "", filename or "", flags=re.I)
    n = re.sub(r"[_]+", " ", n).strip()
    return n[:80] or "sin nombre"


def out_path() -> Path:
    if len(sys.argv) > 1:
        return Path(sys.argv[1])
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from server import config_dir   # noqa: PLC0415
    return config_dir() / "skins.db"


def main():
    DB = out_path()
    DB.parent.mkdir(parents=True, exist_ok=True)
    tmp = DB.with_suffix(".tmp")
    tmp.unlink(missing_ok=True)
    db = sqlite3.connect(tmp)
    db.executescript("""
      CREATE TABLE skins(md5 TEXT PRIMARY KEY, name TEXT, filename TEXT, readme TEXT, cats TEXT, rank INTEGER, featured INTEGER);
      CREATE VIRTUAL TABLE skins_fts USING fts5(name, readme, cats, content='skins', content_rowid='rowid',
                                                tokenize='unicode61 remove_diacritics 2');
    """)
    total = query("{ skins(first:1){ count } }")["skins"]["count"]
    print("skins en el museo:", total)
    seen, rank, skipped = set(), 0, 0
    for off in range(0, total + PAGE, PAGE):
        q = f"{{ skins(first:{PAGE}, offset:{off}, sort: MUSEUM){{ nodes{{ md5 filename nsfw tweeted readme_text }} }} }}"
        nodes = query(q)["skins"]["nodes"]
        if not nodes:
            break
        rows = []
        for n in nodes:
            md5 = n.get("md5") or ""
            if not re.fullmatch(r"[0-9a-f]{32}", md5) or md5 in seen:
                continue
            seen.add(md5)
            rank += 1
            readme = re.sub(r"\s+", " ", n.get("readme_text") or "")[:600]
            name = nice(n.get("filename"))
            text = f"{name} {n.get('filename') or ''} {readme}"
            if n.get("nsfw") or NSFW.search(text):
                skipped += 1
                continue
            # por el nombre, todas; por la descripcion, solo franquicias concretas (casi toda descripcion dice "Winamp")
            by_name, by_readme = f"{name} {n.get('filename') or ''}", readme[:300]
            cats = [k for k, rx in CAT_RE.items() if rx.search(by_name) or (k in FROM_README and rx.search(by_readme))]
            rows.append((md5, name, n.get("filename") or "", readme, "|".join(cats), rank, 1 if n.get("tweeted") else 0))
        db.executemany("INSERT INTO skins VALUES (?,?,?,?,?,?,?)", rows)
        db.commit()
        print(f"{off + len(nodes)}/{total}  guardados {rank - skipped}  excluidos +18 {skipped}", flush=True)
        time.sleep(0.5)   # amable con la API del museo
    db.execute("INSERT INTO skins_fts(rowid, name, readme, cats) SELECT rowid, name, readme, cats FROM skins")
    db.execute("CREATE INDEX skins_rank ON skins(rank)")
    db.commit()
    db.execute("VACUUM")
    db.close()
    tmp.replace(DB)
    print("listo:", DB, "skins:", rank - skipped, "excluidos +18:", skipped)


if __name__ == "__main__":
    main()
