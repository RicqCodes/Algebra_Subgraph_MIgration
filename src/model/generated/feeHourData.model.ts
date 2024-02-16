import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_} from "typeorm"
import * as marshal from "./marshal"

@Entity_()
export class FeeHourData {
    constructor(props?: Partial<FeeHourData>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("text", {nullable: false})
    pool!: string

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    fee!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    changesCount!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    timestamp!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    minFee!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    maxFee!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    startFee!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    endFee!: bigint
}
