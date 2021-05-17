package com.gu.pfi.cli.service

import java.nio.file.Paths

import CliIngestionService.relativise
import org.scalatest.funsuite.AnyFunSuite
import org.scalatest.matchers.must.Matchers

class CliIngestionServiceTest extends AnyFunSuite with Matchers {
  test("relativise") {
    val root = Paths.get("/Users/dave_benson_phillips")
    val gunge = root.resolve("gunge_prices.xlsx")
    val bigRedMover = root.resolve("side_projects/big_red_mover/brochure.rtf")

    relativise(root, gunge) must be("dave_benson_phillips/gunge_prices.xlsx")
    relativise(root, bigRedMover) must be("dave_benson_phillips/side_projects/big_red_mover/brochure.rtf")
  }
}
