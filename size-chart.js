import { regularFit, customSize } from "./size-data.js";

const container = document.getElementById("sizeChart");

container.innerHTML = `
<div class="size-chart">

    <div class="chart-title">
        Size Chart
    </div>

    <div class="chart-card">

        <div class="card-title">
            Regular Fit (Inch)
        </div>

        <table>

            <thead>

                <tr>

                    <th>Size</th>
                    <th>Length</th>
                    <th>Width</th>
                    <th>Sleeve</th>

                </tr>

            </thead>

            <tbody>

                ${regularFit.map(item => `
                    <tr>

                        <td>${item.size}</td>
                        <td>${item.length}</td>
                        <td>${item.width}</td>
                        <td>${item.sleeve}</td>

                    </tr>
                `).join("")}

            </tbody>

        </table>

    </div>

    <div class="chart-card">

        <div class="card-title">
            Add Custom Size
        </div>

        <table>

            <thead>

                <tr>

                    <th>Length</th>
                    <th>Extra Tk</th>
                    <th>Width</th>
                    <th>Extra Tk</th>

                </tr>

            </thead>

            <tbody>

                ${customSize.map(item => `
                    <tr>

                        <td>${item.length}</td>
                        <td>${item.lengthExtra} TK</td>

                        <td>${item.width}</td>
                        <td>${item.widthExtra} TK</td>

                    </tr>
                `).join("")}

            </tbody>

        </table>

    </div>

</div>
`;