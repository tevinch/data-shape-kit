import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.FileTemplateResolver;

public class RenderTemplate {
  public static void main(String[] args) throws Exception {
    FileTemplateResolver resolver = new FileTemplateResolver();
    resolver.setPrefix(Path.of(args[0]).toAbsolutePath().toString() + "/");
    resolver.setSuffix(".html");
    resolver.setTemplateMode(TemplateMode.HTML);
    resolver.setCharacterEncoding("UTF-8");
    resolver.setCacheable(false);
    TemplateEngine engine = new TemplateEngine();
    engine.setTemplateResolver(resolver);
    Context context = new Context(Locale.ENGLISH);
    context.setVariable("title", args[3]);
    context.setVariable("description", args[4]);
    context.setVariable("showDetails", Boolean.valueOf(args[5]));
    String output = engine.process(args[1], context);
    Files.writeString(Path.of(args[2]), output);
    System.out.println("Rendered complete HTML: " + output.length() + " characters");
  }
}
