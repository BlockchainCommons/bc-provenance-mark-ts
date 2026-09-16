//! Replays a vector file against the `provenance-mark` reference crate.
//!
//!   cargo run --release --offline -- ../vectors/vectors.json
//!
//! Every recipe is materialised here with the reference and compared to the
//! TypeScript outcome textually. A rejection renders on both sides as
//! `throw:<code>[<inner code>]|<message>`: the reference's error variant,
//! the variant it wraps for `Bytewords`, `Cbor` and `Envelope`, and its
//! `Display`. A row the reference cannot run because the input is
//! JavaScript-only is `js-only` in a named class; a row where the reference
//! panics at a call the port rejects with a typed error is `panic-mapped`
//! when `PANIC_MAPPED` names the port's code; a row where the port is
//! deliberately right and the reference wrong is `port-right` when
//! `PORT_RIGHT` names it; a recipe field this program cannot read exactly
//! is `unparsable`. Anything else that differs is a MISMATCH. Unparsable
//! rows and mismatches make the process exit 1.
use bc_envelope::prelude::*;
#[allow(unused_imports)]
use bc_ur::prelude::*;
#[allow(unused_imports)]
use dcbor::prelude::*;
use known_values::DirectoryConfig;
use provenance_mark::*;
use serde::Deserialize;
use serde_json::Value as J;
use std::collections::BTreeMap;
use std::panic::{catch_unwind, AssertUnwindSafe};
use std::sync::mpsc;
use std::time::Duration;
use url::Url;

// ---------------------------------------------------------------------------
// Rendering errors the way the TypeScript adapter renders them
// ---------------------------------------------------------------------------

/// The variant name of an error's `Debug` form.
fn variant(e: &impl std::fmt::Debug) -> String {
    let d = format!("{e:?}");
    d.split(|c| c == '(' || c == ' ' || c == '{').next().unwrap_or(&d).to_string()
}
trait Render {
    fn render(&self) -> String;
}
impl Render for Error {
    fn render(&self) -> String {
        let code = match self {
            Error::Bytewords(inner) => format!("Bytewords[{}]", ur_variant(inner)),
            Error::Cbor(inner) => format!("Cbor[{}]", variant(inner)),
            Error::Envelope(inner) => format!("Envelope[{}]", variant(inner)),
            other => variant(other),
        };
        format!("throw:{code}|{self}")
    }
}
/// The port's uniform-resources codes for the reference's `bc_ur::Error` variants.
fn ur_variant(e: &bc_ur::Error) -> String {
    match e {
        bc_ur::Error::UR(_) => "Decoder".to_string(),
        other => variant(other),
    }
}
/// A decoder entry point returns the dcbor error itself; the port throws its `Cbor` code with that message.
impl Render for dcbor::Error {
    fn render(&self) -> String { format!("throw:Cbor[{}]|{self}", variant(self)) }
}
impl Render for bc_ur::Error {
    fn render(&self) -> String { format!("throw:{}|{self}", ur_variant(self)) }
}
/// Persisted JSON is read by serde; the reference wraps its error as `Error::Json`.
impl Render for serde_json::Error {
    fn render(&self) -> String { format!("throw:Json|JSON error: {self}") }
}
impl Render for url::ParseError {
    fn render(&self) -> String { format!("throw:Url|URL parsing error: {self}") }
}
macro_rules! tri {
    ($e:expr) => {
        match $e {
            Ok(v) => v,
            Err(e) => return Err(e.render()),
        }
    };
}
/// A recipe field this program cannot read exactly is an `unparsable` row.
macro_rules! need {
    ($e:expr, $what:expr) => {
        match $e {
            Some(v) => v,
            None => return Err(format!("unparsable:{}", $what)),
        }
    };
}

// ---------------------------------------------------------------------------
// The vector file and the recipe fields
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct File { count: usize, vectors: Vec<Vector> }
#[derive(Deserialize, Clone)]
struct Vector { name: String, recipe: J, expect: String }
type R<T> = std::result::Result<T, String>;

fn s(v: &J, k: &str) -> Option<String> { v.get(k).and_then(|x| x.as_str()).map(|x| x.to_string()) }
fn arr<'a>(v: &'a J, k: &str) -> &'a [J] { v.get(k).and_then(|a| a.as_array()).map(|a| a.as_slice()).unwrap_or(&[]) }
fn unhex(h: &str) -> R<Vec<u8>> { hex::decode(h).map_err(|_| format!("unparsable:hex {h}")) }
fn res(v: &J) -> R<ProvenanceMarkResolution> {
    Ok(match need!(s(v, "res"), "res").as_str() {
        "low" => ProvenanceMarkResolution::Low,
        "medium" => ProvenanceMarkResolution::Medium,
        "quartile" => ProvenanceMarkResolution::Quartile,
        "high" => ProvenanceMarkResolution::High,
        other => return Err(format!("unparsable:res {other}")),
    })
}
/// The port's `parseDate`: a rejected string is `InvalidDate` with the dcbor error's message.
fn date(text: &str) -> R<Date> {
    Date::from_string(text).map_err(|e| format!("throw:InvalidDate|invalid date: {e}"))
}
fn outputs(mark: &ProvenanceMark) -> String {
    let env: Envelope = mark.clone().into();
    let rows = [
        ("debug", format!("{mark:?}")),
        ("display", format!("{mark}")),
        ("message", hex::encode(mark.message())),
        ("cbor", hex::encode(mark.tagged_cbor().to_cbor_data())),
        ("ur", mark.ur_string()),
        ("url", mark.to_url_encoding()),
        ("bytewords", mark.to_bytewords_with_style(bytewords::Style::Standard)),
        ("bytewordsUri", mark.to_bytewords_with_style(bytewords::Style::Uri)),
        ("bytewordsMinimal", mark.to_bytewords_with_style(bytewords::Style::Minimal)),
        ("idHex", mark.id_hex()),
        ("idBytewords", mark.id_bytewords(4, true)),
        ("idBytemoji", mark.id_bytemoji(4, true)),
        ("idMinimal", mark.id_bytewords_minimal(4, true)),
        ("json", serde_json::to_string(mark).unwrap()),
        ("envelope", env.format()),
    ];
    rows.iter().map(|(k, v)| format!("{k}={v}")).collect::<Vec<_>>().join("\n")
}
/// The reference "Wolf" chain's genesis mark at a resolution.
fn wolf_genesis(rs: ProvenanceMarkResolution) -> ProvenanceMark {
    let mut g = ProvenanceMarkGenerator::new_with_passphrase(rs, "Wolf");
    g.next(Date::from_string("2023-06-20T12:00:00Z").unwrap(), None::<String>)
}
/// The port's `fromUR(UR.parse(s))` in the reference's steps: the UR grammar, the type check, the decoder.
fn mark_from_ur(text: &str) -> R<ProvenanceMark> {
    let ur = tri!(UR::from_ur_string(text));
    if let Err(err) = ur.check_type("provenance") {
        return Err(dcbor::Error::Custom(err.to_string()).render());
    }
    Ok(tri!(ProvenanceMark::from_untagged_cbor(ur.cbor())))
}
fn from_json<T: serde::de::DeserializeOwned>(json: &J) -> R<T> {
    serde_json::from_value(json.clone()).map_err(|e| e.render())
}

fn run(r: &J) -> R<String> {
    match need!(s(r, "k"), "k").as_str() {
        "generator" => {
            let rs = res(r)?;
            let mut g = if let Some(seed) = s(r, "seed") {
                let bytes: [u8; 32] = need!(unhex(&seed)?.try_into().ok(), "a 32-byte seed");
                ProvenanceMarkGenerator::new_with_seed(rs, ProvenanceSeed::from_bytes(bytes))
            } else {
                ProvenanceMarkGenerator::new_with_passphrase(rs, &need!(s(r, "passphrase"), "passphrase"))
            };
            let mut blocks = Vec::new();
            for spec in arr(r, "marks") {
                let d = date(&need!(s(spec, "date"), "date"))?;
                let mark = if let Some(h) = s(spec, "infoHex") {
                    g.next(d, Some(tri!(CBOR::try_from_data(unhex(&h)?))))
                } else if let Some(info) = s(spec, "info") {
                    g.next(d, Some(info))
                } else {
                    g.next(d, None::<String>)
                };
                blocks.push(outputs(&mark));
            }
            Ok(format!("{}\n===\ngenerator={}", blocks.join("\n---\n"), serde_json::to_string(&g).unwrap()))
        }
        "decode" => {
            let rs = res(r)?;
            let text = need!(s(r, "s"), "s");
            let mark = match need!(s(r, "form"), "form").as_str() {
                "message" => tri!(ProvenanceMark::from_message(rs, unhex(&text)?)),
                "cbor" => tri!(ProvenanceMark::from_tagged_cbor_data(unhex(&text)?)),
                "ur" => mark_from_ur(&text)?,
                "url" => tri!(ProvenanceMark::from_url_encoding(&text)),
                "bytewords" => tri!(ProvenanceMark::from_bytewords(rs, &text)),
                other => return Err(format!("unparsable:form {other}")),
            };
            Ok(format!("{mark:?}"))
        }
        "validate" => {
            let rs = res(r)?;
            let mut marks = Vec::new();
            for c in arr(r, "chains") {
                for m in need!(c.as_array(), "chain") {
                    marks.push(tri!(ProvenanceMark::from_message(rs, unhex(need!(m.as_str(), "message"))?)));
                }
            }
            let report = ValidationReport::validate(marks);
            let pretty = r.get("pretty").and_then(|b| b.as_bool()).unwrap_or(false);
            let json = report.format(if pretty { ValidationReportFormat::JsonPretty } else { ValidationReportFormat::JsonCompact });
            Ok(format!("{}\n===\n{}", report.format(ValidationReportFormat::Text), json))
        }
        "date" => {
            let rs = res(r)?;
            if let Some(d) = s(r, "date") {
                Ok(hex::encode(tri!(rs.serialize_date(date(&d)?))))
            } else {
                Ok(tri!(rs.deserialize_date(&unhex(&need!(s(r, "bytes"), "bytes"))?)).to_string())
            }
        }
        "json" => {
            let json = need!(r.get("json"), "json");
            match need!(s(r, "target"), "target").as_str() {
                "mark" => {
                    let mark: ProvenanceMark = from_json(json)?;
                    Ok(format!("{mark:?}\njson={}", serde_json::to_string(&mark).unwrap()))
                }
                "generator" => {
                    let g: ProvenanceMarkGenerator = from_json(json)?;
                    Ok(serde_json::to_string(&g).unwrap())
                }
                other => Err(format!("unparsable:target {other}")),
            }
        }
        "genEnvelope" => {
            let rs = res(r)?;
            let g = ProvenanceMarkGenerator::new_with_passphrase(rs, &need!(s(r, "passphrase"), "passphrase"));
            let mut env: Envelope = g.into();
            for pair in arr(r, "extra") {
                let predicate = need!(pair.get(0).and_then(|p| p.as_str()), "predicate");
                env = match pair.get(1) {
                    Some(J::String(text)) => env.add_assertion(predicate, text.clone()),
                    Some(J::Number(n)) => env.add_assertion(predicate, need!(n.as_i64(), "object")),
                    _ => return Err("unparsable:object".into()),
                };
            }
            let back = tri!(ProvenanceMarkGenerator::try_from(env));
            Ok(serde_json::to_string(&back).unwrap())
        }
        "url" => Ok(wolf_genesis(res(r)?).to_url(&need!(s(r, "base"), "base")).to_string()),
        "fromurl" => {
            let url = tri!(Url::parse(&need!(s(r, "url"), "url")));
            let mark = tri!(ProvenanceMark::from_url(&url));
            Ok(format!("{mark:?}"))
        }
        "cbor" => {
            let bytes = unhex(&need!(s(r, "hex"), "hex"))?;
            let mark = match need!(s(r, "via"), "via").as_str() {
                // The port's codec decodes the tagged form, as the reference's `TryFrom<CBOR>`.
                "tagged" | "codec" => tri!(ProvenanceMark::try_from(tri!(CBOR::try_from_data(&bytes)))),
                "untagged" => tri!(ProvenanceMark::from_untagged_cbor(tri!(CBOR::try_from_data(&bytes)))),
                "data" => tri!(ProvenanceMark::from_tagged_cbor_data(&bytes)),
                other => return Err(format!("unparsable:via {other}")),
            };
            Ok(format!("{mark:?}"))
        }
        "identifier" => {
            let mark = wolf_genesis(res(r)?);
            let words = need!(r.get("words").and_then(|w| w.as_u64()), "words") as usize;
            Ok(match need!(s(r, "style"), "style").as_str() {
                "bytewords" => mark.id_bytewords(words, false),
                "minimal" => mark.id_bytewords_minimal(words, false),
                "bytemoji" => mark.id_bytemoji(words, false),
                other => return Err(format!("unparsable:style {other}")),
            })
        }
        "parse" => Ok(date(&need!(s(r, "date"), "date"))?.to_string()),
        "bytes" => {
            let cbor = CBOR::to_byte_string(unhex(&need!(s(r, "hex"), "hex"))?);
            Ok(match need!(s(r, "kind"), "kind").as_str() {
                "seed" => tri!(ProvenanceSeed::try_from(cbor)).hex(),
                "rngState" => tri!(RngState::try_from(cbor)).hex(),
                other => return Err(format!("unparsable:kind {other}")),
            })
        }
        "domain" => Ok(format!("js-only:{}", need!(s(r, "cls"), "cls"))),
        other => Err(format!("unparsable:kind {other}")),
    }
}

// ---------------------------------------------------------------------------
// Panics the port rejects with a typed error, and divergences where the port is right
// ---------------------------------------------------------------------------

/// (recipe kind, panic text, port code)
const PANIC_MAPPED: &[(&str, &str, &str)] = &[
    // The identifier renderers assert the word count; the port throws `RangeError`.
    ("identifier", "word_count must be 4..=32", "RangeError"),
    // `next` unwraps the date codec; the port throws the codec's error.
    ("generator", "YearOutOfRange", "YearOutOfRange"),
    ("generator", "DateOutOfRange", "DateOutOfRange"),
    ("generator", "InvalidMonthOrDay", "InvalidMonthOrDay"),
];
fn panic_mapped(kind: &str, text: &str) -> Option<&'static str> {
    PANIC_MAPPED.iter().find(|(k, needle, _)| *k == kind && text.contains(needle)).map(|(_, _, code)| *code)
}
/// (recipe kind, needle in the recipe's JSON, reason): rows whose difference is the port's deliberate correction.
const PORT_RIGHT: &[(&str, &str, &str)] = &[
    // `to_url` appends a second `provenance` parameter and `from_url` then reads the first; the port replaces it.
    ("url", "provenance=old", "toUrl replaces an existing provenance parameter"),
    // The reference's serde path skips the chain-id length check its constructor enforces; the port checks it.
    ("json", "\"chainID\":\"AAAA\"", "generator JSON checks the chain-id length"),
];
fn port_right(kind: &str, recipe: &J) -> Option<&'static str> {
    let text = recipe.to_string();
    PORT_RIGHT.iter().find(|(k, needle, _)| *k == kind && text.contains(needle)).map(|(_, _, why)| *why)
}
/// The port's code in a `throw:<code>[<inner>]|<message>` outcome.
fn ts_code(want: &str) -> Option<&str> {
    let rest = want.strip_prefix("throw:")?;
    Some(rest.split(|c| c == '[' || c == '|').next().unwrap_or(rest))
}
fn payload(p: Box<dyn std::any::Any + Send>) -> String {
    if let Some(s) = p.downcast_ref::<&str>() { return s.to_string(); }
    if let Some(s) = p.downcast_ref::<String>() { return s.clone(); }
    "non-string panic payload".into()
}
enum Got { Value(String), Panic(String), Hang }
fn run_guarded(v: &Vector, timeout: Duration) -> Got {
    let (tx, rx) = mpsc::channel();
    let recipe = v.recipe.clone();
    std::thread::spawn(move || {
        let got = match catch_unwind(AssertUnwindSafe(|| match run(&recipe) { Ok(s) => s, Err(e) => e })) {
            Ok(s) => Got::Value(s),
            Err(p) => Got::Panic(payload(p)),
        };
        let _ = tx.send(got);
    });
    rx.recv_timeout(timeout).unwrap_or(Got::Hang)
}

fn main() {
    assert_eq!(usize::BITS, 64, "the reference's usize fields are compared as 64-bit integers");
    // No registry directory: the vectors never depend on the runner's home.
    known_values::set_directory_config(DirectoryConfig::new()).expect("the directory configuration is set before any access");
    provenance_mark::register_tags();
    let args: Vec<String> = std::env::args().collect();
    let path = args.get(1).expect("usage: provenance-mark-validation <vectors.json> [--verbose]");
    let verbose = args.iter().any(|a| a == "--verbose") || std::env::var("VERBOSE").is_ok();
    let file: File = serde_json::from_str(&std::fs::read_to_string(path).expect("read vectors")).expect("parse vectors");
    assert_eq!(file.count, file.vectors.len(), "the file's count must equal its vectors");
    std::panic::set_hook(Box::new(|_| {}));

    let (mut ok, mut mapped, mut js_only, mut right, mut mismatch, mut unparsable) = (0usize, 0usize, 0usize, 0usize, 0usize, 0usize);
    let mut js_by: BTreeMap<String, usize> = Default::default();
    let mut dump: BTreeMap<String, String> = Default::default();
    let cut = |x: &str| if verbose { x.to_string() } else { x.chars().take(200).collect::<String>() };
    let report_mismatch = |name: &str, detail: String| eprintln!("MISMATCH {name}\n  {detail}");

    for v in &file.vectors {
        let kind = s(&v.recipe, "k").unwrap_or_default();
        let want = v.expect.as_str();
        match run_guarded(v, Duration::from_secs(300)) {
            Got::Value(got) => {
                dump.insert(v.name.clone(), got.clone());
                if got == want { ok += 1; continue; }
                if let Some(class) = got.strip_prefix("js-only:") { js_only += 1; *js_by.entry(class.to_string()).or_default() += 1; continue; }
                if let Some(what) = got.strip_prefix("unparsable:") { unparsable += 1; eprintln!("UNPARSABLE {} ({what})", v.name); continue; }
                if let Some(why) = port_right(&kind, &v.recipe) { right += 1; if verbose { eprintln!("PORT-RIGHT {} ({why})", v.name); } continue; }
                let (g, w): (Vec<&str>, Vec<&str>) = (got.lines().collect(), want.lines().collect());
                let line = (0..g.len().max(w.len())).find(|&i| g.get(i) != w.get(i)).unwrap_or(0);
                mismatch += 1;
                report_mismatch(&v.name, format!("[line {line}/{}]\n  rust: {}\n  ts:   {}", w.len(), cut(g.get(line).unwrap_or(&"")), cut(w.get(line).unwrap_or(&""))));
            }
            Got::Panic(text) => match panic_mapped(&kind, &text) {
                Some(code) if ts_code(want) == Some(code) => mapped += 1,
                Some(code) => { mismatch += 1; report_mismatch(&v.name, format!("reference panicked ({}) mapped to {code}\n  ts: {}", cut(&text), cut(want))) }
                None => { mismatch += 1; report_mismatch(&v.name, format!("unhandled reference panic: {}\n  ts: {}", cut(&text), cut(want))) }
            },
            Got::Hang => { mismatch += 1; report_mismatch(&v.name, format!("reference did not return within 300s\n  ts: {}", cut(want))) }
        }
    }
    if let Ok(path) = std::env::var("DUMP") { std::fs::write(path, serde_json::to_string_pretty(&dump).unwrap()).unwrap(); }
    let js_detail: Vec<String> = js_by.iter().map(|(k, n)| format!("{k} {n}")).collect();
    println!(
        "{} vectors - {ok} match, {mapped} panic-mapped, {js_only} js-only ({}), {right} port-right, {unparsable} unparsable, {mismatch} MISMATCH",
        file.vectors.len(), js_detail.join(", ")
    );
    std::process::exit(if mismatch == 0 && unparsable == 0 { 0 } else { 1 });
}
