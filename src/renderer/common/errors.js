

export default function E(msg) {

    const d = Date.now()

    return  `
    Time: ${d.toString()}
    ${msg}
    `
}