#!/bin/bash

# Create directories for TeX .aux and .log files, SVG files, and benchmark
# results
rm -rf \
    build \
    svg \
    svg-optimized \
    results/benchmarks-conversion.json \
    results/benchmarks-conversion.csv \
    results/benchmarks-conversion.md \
    results/benchmarks-filesize.json \
    results/benchmarks-filesize-optimized.json

mkdir -p build svg svg-optimized results

for file in gradient plot text transparency; do
    latexmk -dvi -outdir=build/pdflatexmk-dvi "files/dvi/${file}"
    latexmk -pdf -outdir=build/pdflatexmk-pdf "files/pdf/${file}"
    latexmk -dvilua -outdir=build/lualatexmk-dvi "files/dvi/${file}"
    latexmk -pdflua -outdir=build/lualatexmk-pdf "files/pdf/${file}"
    latexmk -xdv -outdir=build/xelatexmk-dvi "files/dvi/${file}"
    latexmk -pdfxe -outdir=build/xelatexmk-pdf "files/pdf/${file}"

    lualatex --output-format=dvi "files/dvi/${file}"
    rm -rf "${file}.aux" "${file}.log"
    mkdir -p "build/lualatex-dvi"
    mv "${file}.dvi" "build/lualatex-dvi/${file}.dvi"

    pdflatex -output-format=dvi "files/dvi/${file}"
    rm -rf "${file}.aux" "${file}.log"
    mkdir -p "build/pdflatex-dvi"
    mv "${file}.dvi" "build/pdflatex-dvi/${file}.dvi"

    xelatex -no-pdf "files/dvi/${file}"
    rm -rf "${file}.aux" "${file}.log"
    mkdir -p "build/xelatex-dvi"
    mv "${file}.xdv" "build/xelatex-dvi/${file}.xdv"

    lualatex --output-format=pdf "files/pdf/${file}"
    rm -rf "${file}.aux" "${file}.log"
    mkdir -p "build/lualatex-pdf"
    mv "${file}.pdf" "build/lualatex-pdf/${file}.pdf"

    pdflatex -output-format=pdf "files/pdf/${file}"
    rm -rf "${file}.aux" "${file}.log"
    mkdir -p "build/pdflatex-pdf"
    mv "${file}.pdf" "build/pdflatex-pdf/${file}.pdf"

    xelatex "files/pdf/${file}"
    rm -rf "${file}.aux" "${file}.log"
    mkdir -p "build/xelatex-pdf"
    mv "${file}.pdf" "build/xelatex-pdf/${file}.pdf"
done

hyperfine \
    --prepare 'rm -rf svg && mkdir svg' \
    --warmup 3 \
    --parameter-list file gradient,plot,text,transparency \
    --export-json results/benchmarks-conversion.json \
    --export-csv results/benchmarks-conversion.csv \
    --export-markdown results/benchmarks-conversion.md \
    'dvisvgm --currentcolor=#000 --font-format=woff2 --output=svg/pdflatex-dvi-dvisvgm.svg build/pdflatex-dvi/{file}.dvi' \
    'dvisvgm --currentcolor=#000 --font-format=woff2 --output=svg/lualatex-dvi-dvisvgm.svg build/lualatex-dvi/{file}.dvi' \
    'dvisvgm --currentcolor=#000 --font-format=woff2 --output=svg/xelatex-dvi-dvisvgm.svg build/xelatex-dvi/{file}.xdv' \
    'dvisvgm --currentcolor=#000 --font-format=woff2 --output=svg/pdflatexmk-dvi-dvisvgm.svg build/pdflatexmk-dvi/{file}' \
    'dvisvgm --currentcolor=#000 --font-format=woff2 --output=svg/xelatexmk-dvi-dvisvgm.svg build/xelatexmk-dvi/{file}' \
    'dvisvgm --currentcolor=#000 --font-format=woff2 --output=svg/lualatexmk-dvi-dvisvgm.svg build/lualatexmk-dvi/{file}' \
    'dvisvgm --pdf --currentcolor=#000 --font-format=woff2 --output=svg/pdflatex-pdf-dvisvgm.svg build/pdflatex-pdf/{file}.pdf' \
    'dvisvgm --pdf --currentcolor=#000 --font-format=woff2 --output=svg/lualatex-pdf-dvisvgm.svg build/lualatex-pdf/{file}.pdf' \
    'dvisvgm --pdf --currentcolor=#000 --font-format=woff2 --output=svg/xelatex-pdf-dvisvgm.svg build/xelatex-pdf/{file}.pdf' \
    'dvisvgm --pdf --currentcolor=#000 --font-format=woff2 --output=svg/pdflatexmk-pdf-dvisvgm.svg build/pdflatexmk-pdf/{file}.pdf' \
    'dvisvgm --pdf --currentcolor=#000 --font-format=woff2 --output=svg/xelatexmk-pdf-dvisvgm.svg build/xelatexmk-pdf/{file}.pdf' \
    'dvisvgm --pdf --currentcolor=#000 --font-format=woff2 --output=svg/lualatexmk-pdf-dvisvgm.svg build/lualatexmk-pdf/{file}.pdf' \
    'pdftocairo -svg build/lualatexmk-pdf/{file}.pdf svg/lualatexmk-pdf-pdftocairo.svg' \
    'pdftocairo -svg build/xelatexmk-pdf/{file}.pdf svg/xelatexmk-pdf-pdftocairo.svg' \
    'pdftocairo -svg build/pdflatexmk-pdf/{file}.pdf svg/pdflatexmk-pdf-pdftocairo.svg' \
    'pdftocairo -svg build/lualatex-pdf/{file}.pdf svg/lualatex-pdf-pdftocairo.svg' \
    'pdftocairo -svg build/pdflatex-pdf/{file}.pdf svg/pdflatex-pdf-pdftocairo.svg' \
    'pdftocairo -svg build/xelatex-pdf/{file}.pdf svg/xelatex-pdf-pdftocairo.svg'

rm -rf svg
mkdir -p svg

for file in gradient plot text transparency; do
    dvisvgm --currentcolor=#000 --font-format=woff2 --output="svg/${file}-pdflatex-dvi-dvisvgm.svg" "build/pdflatex-dvi/${file}.dvi"
    dvisvgm --currentcolor=#000 --font-format=woff2 --output="svg/${file}-xelatex-dvi-dvisvgm.svg" "build/xelatex-dvi/${file}.xdv"
    dvisvgm --currentcolor=#000 --font-format=woff2 --output="svg/${file}-lualatex-dvi-dvisvgm.svg" "build/lualatex-dvi/${file}.dvi"
    dvisvgm --currentcolor=#000 --font-format=woff2 --output="svg/${file}-pdflatexmk-dvi-dvisvgm.svg" "build/pdflatexmk-dvi/${file}"
    dvisvgm --currentcolor=#000 --font-format=woff2 --output="svg/${file}-xelatexmk-dvi-dvisvgm.svg" "build/xelatexmk-dvi/${file}"
    dvisvgm --currentcolor=#000 --font-format=woff2 --output="svg/${file}-lualatexmk-dvi-dvisvgm.svg" "build/lualatexmk-dvi/${file}"
    dvisvgm --pdf --currentcolor=#000 --font-format=woff2 --output="svg/${file}-pdflatexmk-pdf-dvisvgm.svg" "build/pdflatexmk-pdf/${file}.pdf"
    dvisvgm --pdf --currentcolor=#000 --font-format=woff2 --output="svg/${file}-xelatexmk-pdf-dvisvgm.svg" "build/xelatexmk-pdf/${file}.pdf"
    dvisvgm --pdf --currentcolor=#000 --font-format=woff2 --output="svg/${file}-lualatexmk-pdf-dvisvgm.svg" "build/lualatexmk-pdf/${file}.pdf"
    dvisvgm --pdf --currentcolor=#000 --font-format=woff2 --output="svg/${file}-pdflatex-pdf-dvisvgm.svg" "build/pdflatex-pdf/${file}.pdf"
    dvisvgm --pdf --currentcolor=#000 --font-format=woff2 --output="svg/${file}-xelatex-pdf-dvisvgm.svg" "build/xelatex-pdf/${file}.pdf"
    dvisvgm --pdf --currentcolor=#000 --font-format=woff2 --output="svg/${file}-lualatex-pdf-dvisvgm.svg" "build/lualatex-pdf/${file}.pdf"
    pdftocairo -svg "build/pdflatexmk-pdf/${file}.pdf" "svg/${file}-pdflatexmk-pdf-pdftocairo.svg"
    pdftocairo -svg "build/xelatexmk-pdf/${file}.pdf" "svg/${file}-xelatexmk-pdf-pdftocairo.svg"
    pdftocairo -svg "build/lualatexmk-pdf/${file}.pdf" "svg/${file}-lualatexmk-pdf-pdftocairo.svg"
    pdftocairo -svg "build/pdflatex-pdf/${file}.pdf" "svg/${file}-pdflatex-pdf-pdftocairo.svg"
    pdftocairo -svg "build/xelatex-pdf/${file}.pdf" "svg/${file}-xelatex-pdf-pdftocairo.svg"
    pdftocairo -svg "build/lualatex-pdf/${file}.pdf" "svg/${file}-lualatex-pdf-pdftocairo.svg"
done
filesizes_json="results/benchmarks-filesize.json"
echo "[" >> $filesizes_json
filesizes_optimized_json="results/benchmarks-filesize-optimized.json"
echo "[" >> $filesizes_optimized_json

cp -r svg/. svg-optimized/
svgo --folder svg-optimized

cd svg || (echo "Directory 'svg' not found" && exit)

for file in *; do
    svg_size=$(wc -c "$file" | awk '{print $1}')
    file_basename=$(echo "$file" | cut -d'-' -f1)
    tex_engine=$(echo "$file" | cut -d'-' -f2)
    output_format=$(echo "$file" | cut -d'-' -f3)
    converter=$(echo "$file" | cut -d'-' -f4)
    converter=$(echo "$converter" | cut -d'.' -f1)
    echo "{\"file\":\"${file_basename}\",\"engine\":\"${tex_engine}\",\"format\":\"${output_format}\",\"converter\":\"${converter}\",\"size\":${svg_size}}," >> ../$filesizes_json
done

echo "null]" >> ../$filesizes_json # Close JSON array

cd ../svg-optimized || (echo "Directory 'svg-optimized' not found" && exit)

for file in *; do
    svg_size=$(wc -c "$file" | awk '{print $1}')
    file_basename=$(echo "$file" | cut -d'-' -f1)
    tex_engine=$(echo "$file" | cut -d'-' -f2)
    output_format=$(echo "$file" | cut -d'-' -f3)
    converter=$(echo "$file" | cut -d'-' -f4)
    converter=$(echo "$converter" | cut -d'.' -f1)
    echo "{\"file\":\"${file_basename}\",\"engine\":\"${tex_engine}\",\"format\":\"${output_format}\",\"converter\":\"${converter}\",\"size\":${svg_size}}," >> ../$filesizes_optimized_json
done

echo "null]" >> ../$filesizes_optimized_json # Close JSON array
