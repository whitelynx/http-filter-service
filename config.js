module.exports = {
    port: 3030,
    filters: {
        cat: "cat -",
        tac: "tac -",
        plantuml: "plantuml -t${format} -p",
        pandoc: "pandoc --from=${from} --to=${to}"
    }
};
