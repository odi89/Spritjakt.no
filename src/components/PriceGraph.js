import React from "react";
import { ResponsiveLine } from "@nivo/line";
import "./css/priceGraph.css";
import SortArray from "sort-array";
import HighlightedProduct from "./HighlightedProduct";
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

class PriceGraph extends React.Component {
  componentDidMount() {
    this.vmpLink.focus();
  }
  render() {
    var { p } = this.props;

    let config = {
      id: p.Name,
      color: "#49908d",
      data: [],
    };
    let today = new Date();
    today.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());

    var pricesReversed = p.PriceHistorySorted.slice();
    pricesReversed.reverse();

    var oldPrice = p.PriceHistory[pricesReversed[0]];

    var millisecondsPerDay = 24 * 60 * 60 * 1000;
    let numberOfDays =
      (today.getTime() - pricesReversed[0]) / millisecondsPerDay;

    let date = new Date(parseInt(pricesReversed[0]));
    var mostRecentPrice = oldPrice;
    for (let i = 0; i < numberOfDays; i++) {
      if (p.PriceHistory[date.getTime()]) {
        mostRecentPrice = p.PriceHistory[date.getTime()];
      }
      let datestring = date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate();
      config.data.push({ x: datestring, y: mostRecentPrice });

      date.setDate(date.getDate() + 1);
    }

    let priceSortedByAmount = SortArray(Object.values(p.PriceHistory), {
      order: "desc",
    });
    let minPrice = priceSortedByAmount[priceSortedByAmount.length - 1] * 0.8;
    let maxPrice = priceSortedByAmount[0] * 1.2;
    return (
      <div className="expandedProduct">
        <HighlightedProduct product={p} isGraph={false} />
        <a
          rel="noreferrer"
          ref={(link) => {
            this.vmpLink = link;
          }}
          className="clickable"
          target="_blank"
          href={"https://www.vinmonopolet.no/p/" + p.Id}
        >
          Se hos vinmonopolet
          <FontAwesomeIcon icon={faExternalLinkAlt} />
        </a>
        <h3 className="title">Prishistorikk</h3>
        <div className="graph">
          <ResponsiveLine
            data={[config]}
            margin={{
              top: 20,
              right: 20,
              bottom: 40,
              left: 40,
            }}
            yScale={{
              type: "linear",
              min: minPrice,
              max: maxPrice,
              stacked: false,
              reverse: false,
            }}
            curve="step"
            axisTop={null}
            axisRight={null}
            axisLeft={{
              tickValues: 5,
            }}
            xScale={{
              type: "time",
              format: "%Y-%m-%d",
              precision: "day",
            }}
            xFormat="time:%Y-%m-%d"
            axisBottom={{
              orient: "left",
              format: "%d %b",
              legendOffset: 0,
              tickRotation: -25,
              tickSize: 5,
              tickPadding: 5,
              tickValues: "every 10 days",
              legendPosition: "middle",
            }}
            areaBaselineValue={minPrice}
            enableGridX={false}
            colors={{
              datum: "color",
            }}
            lineWidth={3}
            enableArea={true}
            enablePoints={false}
            areaOpacity={0.5}
            crosshairType="x"
            useMesh={true}
            legends={[]}
            enableSlices="x"
            sliceTooltip={({ slice }) => {
              return (
                <div
                  style={{
                    background: "#49908d",
                    padding: "9px 12px",
                    borderRadius: "3px",
                    color: "white",
                    boxShadow: "1px 1px 5px rgba(0,0,0,.3)",
                  }}
                >
                  {slice.points.map((point) => (
                    <div
                      key={point.id}
                      style={{
                        padding: "3px 0",
                      }}
                    >
                      <span>{point.data.xFormatted}</span>
                      <br />
                      <strong>{point.data.yFormatted},-</strong>
                    </div>
                  ))}
                </div>
              );
            }}
          />
        </div>
      </div>
    );
  }
}

export default PriceGraph;
